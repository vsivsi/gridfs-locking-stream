
// fixture/logo.png
var assert = require('assert'),
  Stream = require('stream'),
  fs = require('fs'),
  mongo = require('mongodb'),
  Grid = require('../'),
  fixturesDir = __dirname + '/fixtures/',
  imgReadPath = __dirname + '/fixtures/mongo.png',
  txtReadPath = __dirname + '/fixtures/text.txt',
  server,
  db;

describe('test', function(){
  var id;
  before(function (done) {
    server = new mongo.Server('localhost', 27017);
    db = new mongo.Db('gridstream_test', server, {w:1});
    db.open(done);
  });

  describe('Grid', function () {
    it('should be a function', function () {
      assert('function' == typeof Grid);
    });
    it('should create instances without the new keyword', function () {
      var x = Grid(2,3,4);
      assert(x instanceof Grid);
    });
    it('should store the arguments', function () {
      var x = new Grid(4, 5, 6);
      assert.equal(x.db, 4);
      assert.equal(x.mongo, 5);
      assert.equal(x.root, 6);
    });
    it('should require mongo argument', function(){
      assert.throws(function () {
        new Grid(3);
      }, /missing mongo argument/);
    });
    it('should require db argument', function(){
      assert.throws(function () {
        new Grid(null, 3);
      }, /missing db argument/);
    });
    it('should default .root to the value of GridStore.DEFAULT_ROOT_COLLECTION', function(){
      var x = Grid(db, mongo);
      assert.equal(x.root, mongo.GridStore.DEFAULT_ROOT_COLLECTION);
    });
    describe('files', function(){
      it('returns a collection', function(){
        var g = new Grid(db, mongo);
        assert(g.files instanceof mongo.Collection);
      });
    });
    describe('locks', function(){
      it('returns a collection', function(){
        var g = new Grid(db, mongo);
        assert(g.locks instanceof mongo.Collection);
      });
    });
  });

  describe('createWriteStream', function(){
    it('should be a function', function () {
      var x = Grid(1, mongo);
      assert('function' == typeof x.createWriteStream);
    });
  });

  describe('GridWriteStream', function(){
    var g;
    var ws;

    before(function(done){
      Grid.mongo = mongo;
      g = Grid(db);
      ws = null;
      g.createWriteStream({ filename: 'logo.png' }, function(e, stream) {
        ws = stream;
        done();
      });
    });

    it('should be an instance of Stream', function(){
      assert(ws instanceof Stream);
    });
    it('should should be writable', function(){
      assert(ws.writable);
    });
    it('should store the grid', function(){
      assert(ws._grid == g);
    });
    it('should have an id', function(){
      assert(ws.id);
    });
    it('id should be an ObjectId', function(){
      assert(ws.id instanceof mongo.ObjectID);
    });
    it('should have a name', function(){
      assert(ws.name == 'logo.png');
    });
    describe('options', function(){
      it('should have three keys', function(){
        // console.log("Keys: " + Object.keys(ws.options));
        assert(Object.keys(ws.options).length === 3);
      });
    });
    it('mode should default to w', function(){
      assert(ws.mode == 'w');
    });
    describe('store', function(){
      it('should be an instance of mongo.GridStore', function(){
        assert(ws._store instanceof mongo.GridStore);
      });
    });
    describe('#methods', function(){
      describe('write', function(){
        it('should be a function', function(){
          assert('function' == typeof ws.write);
        });
      });
      describe('end', function(){
        it('should be a function', function(){
          assert('function' == typeof ws.end);
        });
      });
      describe('destroy', function(){
        it('should be a function', function(){
          assert('function' == typeof ws.destroy);
        });
      });
      describe('destroySoon', function(){
        it('should be a function', function(){
          assert('function' == typeof ws.destroySoon);
        });
      });
    });
    it('should provide piping from a readableStream into GridFS', function(done){
      var readStream = fs.createReadStream(imgReadPath, { bufferSize: 1024 });
      g.createWriteStream({ filename: 'logo.png'}, function(e, ws) {
        // used in readable stream test
        id = ws.id;

        var progress = 0;

        ws.on('progress', function (size) {
          progress = size;
        });

        ws.on('close', function () {
          assert(progress > 0);
          ws.lockReleased(function () {
            done();
          });
        });

        var pipe = readStream.pipe(ws);
      });
    });
    it('should provide Error and File object on WriteStream close event', function(done){
      var readStream = fs.createReadStream(imgReadPath, { bufferSize: 1024 });
      var ws = g.createWriteStream({
        mode: 'w',
        filename: 'closeEvent.png',
        content_type: "image/png"
      }, function (e, ws) {
        // used in readable stream test
        id = ws.id;

        var progress = 0;

        ws.on('progress', function (size) {
          progress = size;
        });

        ws.on('close', function (file) {
          assert(file.filename === 'closeEvent.png');
          assert(file.contentType === 'image/png');
          assert(progress > 0);
          ws.lockReleased(function () {
            done();
          });
        });

        var pipe = readStream.pipe(ws);
      });
    });
    /* w+ is disable as in mongodb drive 2.0.15 because of possible dat corruption
    it('should pipe more data to an existing GridFS file', function(done){
      function pipe (id, cb) {
        if (!cb) cb = id, id = null;
        var readStream = fs.createReadStream(txtReadPath);
        g.createWriteStream({
          _id: id,
          mode: 'w+' },
          function (e, ws) {
            ws.on('close', function () {
              cb(ws.id);
            });
            readStream.pipe(ws);
          });
      }
      pipe(function (id) {
        pipe(id, function (id) {
          // read the file out. it should consist of two copies of original
          mongo.GridStore.read(db, id, function (err, txt) {
            if (err) return done(err);
            assert.equal(txt.length, fs.readFileSync(txtReadPath).length*2);
            done();
          });
        });
      })
    });
    */
    it('should be able to store a 12-letter file name', function(done) {
      g.createWriteStream({ filename: '12345678.png' }, function(e, ws) {
        assert.equal(ws.name,'12345678.png');
        done();
      });
    });
    it('should expire and automatically close', function(done) {
      this.timeout(5000);
      g.createWriteStream({ filename: 'expire_test.txt', lockExpiration: 2, pollingInterval: 1 }, function(e, ws) {
        ws.on('close', function () { done(); });
      });
    });
    it('should emit expires-soon, renew once, and then expire', function(done) {
      this.timeout(5000);
      var renewed = false;
      g.createWriteStream({ filename: 'expire_test.txt', lockExpiration: 2, pollingInterval: 1 }, function(e, ws) {
        ws.once('expires-soon', function () {
          ws.renewLock(function (err, doc) {
            if (err) return done(err);
            assert.ok(doc);
            renewed = true;
          });
        });
        ws.on('close', function () {
          assert(renewed);
          ws.lockReleased(function () {
            done();
          });
        });
      });
    });
  });

  describe('createReadStream', function(){
    it('should be a function', function () {
      var x = Grid(1);
      assert('function' == typeof x.createReadStream);
    });
  });

  describe('GridReadStream', function(){
    var g;
    var rs;

    before(function(done){
      g = Grid(db);
      g.createReadStream({
        _id: id,
        filename: 'logo.png'
      }, function(e, stream) {
        rs = stream;
        done();
      });
    });

    it('should create an instance of Stream', function(){
      assert(rs instanceof Stream);
    });
    it('should should be readable', function(){
      assert(rs.readable);
    });
    it('should store the grid', function(){
      assert(rs._grid == g);
    });
    it('should have a name', function(){
      assert(rs.name == 'logo.png');
    });
    it('should have an id', function(){
      assert.equal(rs.id, id);
    });
    describe('options', function(){
      it('should have two keys', function(done) {
        g.createReadStream({ _id: id }, function(e, rs) {
          // console.log("Keys: " + Object.keys(rs.options))
          assert(Object.keys(rs.options).length === 2);
          done();
        });
      });
    });
    it('mode should default to r', function(){
      assert(rs.mode == 'r');
      assert(rs._store.mode == 'r');
    });

    describe('store', function(){
      it('should be an instance of mongo.GridStore', function(){
        assert(rs._store instanceof mongo.GridStore);
      });
    });
    describe('#methods', function(){
      describe('setEncoding', function(){
        it('should be a function', function(){
          assert('function' == typeof rs.setEncoding);
          // TODO test actual encodings
        });
      });
      describe('pause', function(){
        it('should be a function', function(){
          assert('function' == typeof rs.pause);
        });
      });
      describe('destroy', function(){
        it('should be a function', function(){
          assert('function' == typeof rs.destroy);
        });
      });
      describe('resume', function(){
        it('should be a function', function(){
          assert('function' == typeof rs.resume);
        });
      });
      describe('pipe', function(){
        it('should be a function', function(){
          assert('function' == typeof rs.pipe);
        });
      });
    });
    it('should provide piping to a writable stream by id', function(done){
      var file = fixturesDir + 'byid.png';
      g.createReadStream({
        _id: id
      }, function(e, rs) {
        var writeStream = fs.createWriteStream(file);
        assert(rs.id instanceof mongo.ObjectID);
        assert(rs.id == String(id));

        var opened = false;
        var ended = false;

        rs.on('open', function () {
          opened = true;
        });

        rs.on('error', function (err) {
          throw err;
        });

        rs.on('end', function () {
          ended = true;
        });

        writeStream.on('close', function () {
           //check they are identical
          assert(opened);
          assert(ended);

          var buf1 = fs.readFileSync(imgReadPath);
          var buf2 = fs.readFileSync(file);

          assert(buf1.length === buf2.length);

          for (var i = 0, len = buf1.length; i < len; ++i) {
            assert(buf1[i] == buf2[i]);
          }

          fs.unlinkSync(file);
          rs.lockReleased(function () {
            done();
          });
        });

        rs.pipe(writeStream);

      });
    });

    it('should be possible to pause a stream after constructing it', function (done) {
      g.createReadStream({ _id: id }, function (e, rs) {
        rs.pause();
        setTimeout(function () {
          rs.resume();
        }, 1000);

        rs.on('data', function (data) {});
        rs.on('end', function () { done(); });
      });
    });

    it('should expire and automatically close', function(done) {
      this.timeout(5000);
      g.createReadStream({ _id: id, lockExpiration: 2, pollingInterval: 1 }, function(e, rs) {
        rs.pause();
        rs.on('data', function (data) {});
        rs.on('close', function () {
          rs.lockReleased(function () {
            done();
          });
        });
      });
    });

    it('should emit expires-soon, renew once, and then expire', function(done) {
      this.timeout(5000);
      var renewed = false;
      g.createReadStream({ _id: id, lockExpiration: 2, pollingInterval: 1 }, function(e, rs) {
        rs.pause();
        rs.on('data', function (data) {});
        rs.once('expires-soon', function () {
          rs.renewLock(function (err, doc) {
            if (err) return done(err);
            assert.ok(doc);
            renewed = true;
          });
        });
        rs.on('close', function () {
          assert(renewed);
          rs.lockReleased(function () {
            done();
          });
        });
      });
    });

    it('should provide piping to a writable stream with a range by id', function(done){
      var file = fixturesDir + 'byid.png';
      g.createReadStream({
        _id: id,
        range: {
          startPos: 1000,
          endPos: 10000
        }
      }, function (err, rs){
        var writeStream = fs.createWriteStream(file);
        assert(rs.id instanceof mongo.ObjectID);
        assert(rs.id == String(id));

        var opened = false;
        var ended = false;

        rs.on('open', function () {
          opened = true;
        });

        rs.on('error', function (err) {
          throw err;
        });

        rs.on('end', function () {
          ended = true;
        });

        writeStream.on('close', function () {
          //check they are identical
          assert(opened);
          assert(ended);

          var buf1 = fs.readFileSync(imgReadPath);
          var buf2 = fs.readFileSync(file);

          assert(buf2.length === rs.options.range.endPos - rs.options.range.startPos + 1);

          for (var i = 0, len = buf2.length; i < len; ++i) {
            assert(buf1[i + rs.options.range.startPos] == buf2[i]);
          }

          fs.unlinkSync(file);
          rs.lockReleased(function () {
            done();
          });
        });

        rs.pipe(writeStream);
      });
    });
  });

  describe('exist', function () {
    var g;

    before(function(done){
      g = Grid(db);
      var readStream = fs.createReadStream(imgReadPath, { bufferSize: 1024 });
      g.createWriteStream({ filename: 'logo.png'}, function(e, ws) {
        id = ws.id;
        ws.on('close', function () {
          done();
        });
        var pipe = readStream.pipe(ws);
      });
    });

    it('should allow checking for existence of files', function(done){
      g.exist({ _id: id }, function (err, result) {
        if (err) return done(err);
        assert.ok(result);
        done();
      });
    });
    it('should allow checking for non existence of files', function(done){
      g.exist({ _id: new mongo.ObjectID() }, function (err, result) {
        if (err) return done(err);
        assert.ok(!result);
        done();
      });
    });
  });

  describe('remove', function(){
    var g;

    before(function(done){
      g = Grid(db);
      var readStream = fs.createReadStream(imgReadPath, { bufferSize: 1024 });
      g.createWriteStream({ filename: 'logo.png'}, function(e, ws) {
        id = ws.id;
        ws.on('close', function () {
          done();
        });
        var pipe = readStream.pipe(ws);
      });
    });

    it('should allow removing files', function(done){
      g.remove({ _id: id }, function (err, res) {
        if (err) return done(err);
        assert.ok(res);
        g.files.findOne({ _id: id }, function (err, doc) {
          if (err) return done(err);
          assert.ok(!doc);
          done();
        });
      });
    });
  });

  after(function (done) {
    db.dropDatabase(function () {
      db.close(true, done);
    });
  });
});
