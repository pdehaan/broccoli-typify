'use strict';

var fs = require('fs');
var expect = require('chai').expect;
var Typify = require('..');
var broccoli = require('broccoli');
var walkSync = require('walk-sync');
var Funnel = require('broccoli-funnel');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

var Compiler = Typify.Compiler;
var toTypescriptOptions =Typify.toTypescriptOptions;

var expectations = __dirname + '/expectations';

function entryFor(path, entries) {
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].relativePath === path) {
      return entries[i];
    }
  }
}

describe('transpile Typescript', function() {
  var builder;

  afterEach(function () {
    return builder && builder.cleanup();
  });

  describe('toTypescriptOptions', function(){
    it("parses options", function(){
      var parsed = toTypescriptOptions({
        // tsc options
        'emitDecoratorMetadata': true,
        'experimentalDecorators': true,
        'declaration': true,
        'stripInternal': true,
        'module': 'commonjs',
        'moduleResolution': 'classic',
        'noEmitOnError': true,
        'rootDir': '.',
        'inlineSourceMap': true,
        'inlineSources': true,
        'target': 'es5'
      });
      expect(parsed.errors).to.be.empty();
    });
  });

  describe('loadProjectTsconfig', function(){
    it('loads the file', function() {
      var load = Typify.loadProjectTsconfig(__dirname);
      expect(load.errors).to.be.empty();
      expect(load.options.target).to.not.be.empty();
    });
  });


  describe('tsOptions', function() {

    it('uses tsOptions', function () {
      builder = new broccoli.Builder(Compiler('tests/fixtures/files',  {tsOptions: toTypescriptOptions({
            "target": "ES6"
      }).options}));

      return builder.build().then(function(results) {
        var outputPath = results.directory;
        var entries = walkSync.entries(outputPath);

        expect(entries).to.have.length(2);

        var output = fs.readFileSync(outputPath + '/fixtures.js', 'UTF8');
        var wanted = fs.readFileSync(expectations + '/expected.es6', 'UTF8');

        expect(output.replace(/\s+/g, ' ')).to.eql(wanted.replace(/\s+/g, ' '));
      });
    });

    describe('tsconfig resolution', function() {
      it('basic resolution', function () {
        builder = new broccoli.Builder(Compiler('tests/fixtures/files'));

        return builder.build().then(function(results) {
          var outputPath = results.directory;

          var output = fs.readFileSync(outputPath + '/fixtures.js').toString().replace(/\s+/g, ' ');
          var input = fs.readFileSync(expectations + '/expected.js').toString().replace(/\s+/g, ' ');

          expect(output).to.eql(input);
        });
      });
    });
  });

  describe('rebuilds', function() {
    var lastEntries, outputPath;

    beforeEach(function() {
      builder = new broccoli.Builder(Compiler('tests/fixtures/files', {
        tsconfig: __dirname + '/fixtures/tsconfig.json'
      }));

      return builder.build().then(function(results) {
        outputPath = results.directory;

        lastEntries = walkSync.entries(outputPath);
        expect(lastEntries).to.have.length(2);
        return builder.build();
      });
    });

    afterEach(function() {
      rimraf.sync('tests/fixtures/files/apple.ts');
      rimraf.sync('tests/fixtures/files/orange.ts');

      rimraf.sync('tests/fixtures/files/red/');
      rimraf.sync('tests/fixtures/files/orange/');
    });

    it('noop rebuild', function() {
      return builder.build().then(function(results) {
        var entries = walkSync.entries(results.directory);

        expect(entries).to.deep.equal(lastEntries);
        expect(entries).to.have.length(2);
      });
    });

    it('mixed rebuild', function() {
      var entries = walkSync.entries(outputPath);
      expect(entries).to.have.length(2);

      fs.writeFileSync('tests/fixtures/files/apple.ts', 'var apple : String;');
      // note: initial test was with .js, will get back to it later.
      fs.writeFileSync('tests/fixtures/files/orange.ts', 'var orange;');

      /* New folders not supported by the DiffingTSCompiler.

       mkdirp.sync('tests/fixtures/files/red/');
       mkdirp.sync('tests/fixtures/files/orange/');

       fs.writeFileSync('tests/fixtures/files/red/one.ts', 'var one : String');
       fs.writeFileSync('tests/fixtures/files/orange/two.js', 'var two');

       */

      return builder.build().then(function(results) {
        var entries = walkSync.entries(results.directory);

        expect(entries).to.not.deep.equal(lastEntries);
        expect(entries).to.have.length(4);

      });
    });
  });
});
