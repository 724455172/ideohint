var fs = require('fs');
var path = require('path');
var stream = require('stream');
var readline = require('readline');
var argv = require('optimist').argv;
var CombinedStream = require('combined-stream');
var glob = require("glob")

var directory = argv._[0];
var outstream = argv.o ? fs.createWriteStream(argv.o, { encoding: 'utf-8' }) : process.stdout;

var cs = CombinedStream.create();
cs.append(fs.createReadStream(path.join(directory, "font.info")))
glob.sync(path.join(directory, '*.glyphs')).forEach(function(f){ cs.append(fs.createReadStream(f)) })
cs.append(fs.createReadStream(path.join(directory, "final.info")));
cs.pipe(outstream)