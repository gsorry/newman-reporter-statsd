'use strict';

var SimpleUdpStream = require('simple-udp-stream');
var snake = require('to-snake-case');

class StatsdReporter {
    constructor(emitter, reporterOptions, options) {
        this.reporterOptions = reporterOptions;
        this.options = options;
        this.flowId = `${new Date().getTime() + Math.random()}`;
        const events = 'start beforeIteration iteration beforeItem item beforePrerequest prerequest beforeScript script beforeRequest request beforeTest test beforeAssertion assertion console exception beforeDone done'.split(' ');
        events.forEach((e) => { if (typeof this[e] == 'function') emitter.on(e, (err, args) => this[e](err, args)) });
    }

    start(err, args) {
        if (!this.reporterOptions.destination) {
            throw `ERROR: Destination address is missing! Add --reporter-statsd-destination \'<destination-address>\'.`;
        }
        if (!this.reporterOptions.port) {
            throw `ERROR: Port is missing! Add --reporter-statsd-port <port-number>.`;
        }
        this.stream = new SimpleUdpStream({
            destination: this.reporterOptions.destination,
            port: this.reporterOptions.port
        });
        console.log(`##statsd[testSuiteStarted name='${this.escape(this.options.collection.name)}' flowId='${this.flowId}']`);
    }

    beforeItem(err, args) {
        this.currItem = {name: this.itemName(args.item), passed: true, failedAssertions: []};
        console.log(`##statsd[testStarted name='${this.currItem.name}' captureStandardOutput='true' flowId='${this.flowId}']`);
    }

    request(err, args) {
        if (!err) {
            this.currItem.response = args.response;
        }
    }

    assertion(err, args) {
        if (err) {
            this.currItem.passed = false;
            this.currItem.failedAssertions.push(args.assertion);
        }
    }

    item(err, args) {
        const metricname = snake(this.currItem.name);
        const responseCode = (this.currItem.response && this.currItem.response.code) || "0";
        const duration = (this.currItem.response && this.currItem.response.responseTime) || 0;
        const passed = 1
        if (!this.currItem.passed) {
            passed = 0
        }
        this.stream.write(`api.${metricname}.responseCode:${responseCode}|c`);
        this.stream.write(`api.${metricname}.duration:${duration}|c`);
        this.stream.write(`api.${metricname}.passed:${passed}|c`);
        console.log(`##statsd[testFinished name='${this.options.collection.name}' flowId='${this.flowId}' metricname='${metricname}' responseCode='${responseCode}' duration='${duration}' passed='${[passed]}']`);
    }

    done(err, args) {
        this.stream.end();
        console.log(`##statsd[testSuiteFinished name='${this.options.collection.name}' flowId='${this.flowId}']`);
    }

    /* HELPERS */
    itemName(item) {
        const parentName = item.parent && item.parent() && item.parent().name ? item.parent().name : "";
        const folderOrEmpty = (!parentName || parentName === this.options.collection.name) ? "" : parentName + "/";
        return this.escape(folderOrEmpty + item.name);
    }

    escape(string) {
        return string;
    }
}

module.exports = StatsdReporter;
