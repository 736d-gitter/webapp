var csv = require('fast-csv');

var metrics = require('datadog-metrics');
metrics.init({ prefix: 'build.benchmarks.' });

csv
 .fromStream(process.stdin, { headers : ["date", "suite", "benchmark", "total", "iterations"] })
 .on("data", function(data) {
   var benchmark = data.benchmark;
   if (!benchmark) return; // Ignore bad lines

   var tag = benchmark.replace(/^.*#/,'');
   var tags = [];

   if(process.env.GIT_COMMIT) tags.push("commit:" + process.env.GIT_COMMIT);
   if(process.env.GIT_BRANCH) tags.push("branch:" + process.env.GIT_BRANCH);
   if (tag) tags.push('test:' + tag);

   var metric = data.suite + "." + benchmark.replace(/#.*/,'');
   var total = parseFloat(data.total);
   var iterations = parseInt(data.iterations, 10);
   var avg = total / iterations;

   if (isNaN(avg)) return; // Ignore bad lines

   console.log(metric + ": ", tags.join(' '), avg);
   metrics.gauge(metric, avg, tags);
 })
 .on("end", function() {
   metrics.flush();
 });
