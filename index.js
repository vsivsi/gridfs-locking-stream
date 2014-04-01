// gridfs-locking-stream

/**
 * Module dependencies.
 */

var Lock = require('gridfs-locks').Lock;
var LockCollection = require('gridfs-locks').LockCollection;

var GridWriteStream = require('gridfs-stream/lib/writestream');
var GridReadStream = require('gridfs-stream/lib/readstream');

/**
 * Grid constructor
 *
 * @param {mongo.Db} db - an open mongo.Db instance
 * @param {mongo} [mongo] - the native driver you are using
 * @param {String} [root] - the root name of the GridFS collection to use
 */

function Grid (db, mongo, root) {
  if (!(this instanceof Grid)) {
    return new Grid(db, mongo, root);
  }
  var self = this;

  mongo || (mongo = Grid.mongo ? Grid.mongo : undefined);

  if (!mongo) throw new Error('missing mongo argument\nnew Grid(db, mongo)');
  if (!db) throw new Error('missing db argument\nnew Grid(db, mongo)');

  // the db must already be open b/c there is no `open` event emitted
  // in old versions of the driver
  self.db = db;
  self.mongo = mongo;
  self.root = root || self.mongo.GridStore.DEFAULT_ROOT_COLLECTION;
}

/**
 * Creates a writable stream.
 *
 * @param {Object} [options]
 * @return Stream
 */

Grid.prototype.createLockCollection = function (options, callback) {
  var self = this;
  self.root = options.root;
  LockCollection.create(self.db, self.root, options, function (err, lockColl) {
    if (err) { return callback(err); }
    self._locks = lockColl;
    callback(null);
  });
}

/**
 * Creates a writable stream.
 *
 * @param {Object} [options]
 * @return Stream
 */

Grid.prototype.createWriteStream = function (options, callback) {
  var self = this;

  function lockAndWrite() {
    var lock = new Lock(options._id, self._locks, options);
    lock.obtainWriteLock(function (err, l) {
      if (err) { return callback(err); }
      if (!l) { return callback(null, null); }
      var stream = new GridWriteStream(self, options);
      stream.releaseLock = function (callback) {
        lock.releaseLock(callback || function () {});
      }
      stream.renewLock = function (callback) {
        lock.renewLock(callback || function () {});
      }
      stream.heldLock = function () {
        return lock.heldLock;
      }
      stream.on('error', function (err) {
        lock.releaseLock(function (err) {
          if (err) {
            console.warn('Warning! releaseLock() failed for GridFS ' + self.root + " _id " + options._id);
          }
        });
      }).on('close', function (file) {
        lock.releaseLock(function (err) {
          if (err) {
            console.warn('Warning! releaseWriteLock() failed for GridFS ' + self.root + " _id " + options._id);
          }
        });
      });
      callback(null, stream, l);
    });
  }

  if (!options._id) {
    // New file
    options._id = new self.mongo.BSONPure.ObjectID
  }

  if (options.root && self.root !== options.root) {
    throw new Error('Root name of Grid object cannot be changed: ' + options.root + " !== " + self.root);
  }

  options.root = self.root;

  if (!self._locks) {
    this.createLockCollection(options, function(err) {
      if (err) { return callback(err); }
      lockAndWrite();
    });
  } else {
    lockAndWrite();
  }
}

/**
 * Creates a readable stream. Pass at least a filename or _id option
 *
 * @param {Object} options
 * @param {function} callback
 * @return Stream
 */

Grid.prototype.createReadStream = function (options, callback) {
  var self = this;

  function lockAndRead() {
    var lock = new Lock(options._id, self._locks, options);
    lock.obtainReadLock(function (err, l) {
      if (err) { return callback(err); }
      if (!l) { return callback(null, null); }
      var stream = new GridReadStream(self, options);
      stream.releaseLock = function (callback) {
        lock.releaseLock(callback || function () {});
      }
      stream.renewLock = function (callback) {
        lock.renewLock(callback || function () {});
      }
      stream.heldLock = function () {
        return lock.heldLock;
      }
      stream.on('error', function (err) {
        lock.releaseLock(function (err) {
          if (err) {
            console.warn('Warning! releaseLock() failed for GridFS ' + self.root + " _id " + options._id);
          }
        });
      }).on('end', function (file) {
        lock.releaseLock(function (err) {
          if (err) {
            console.warn('Warning! releaseLock() failed for GridFS ' + self.root + " _id " + options._id);
          }
        });
      });
      callback(null, stream, l);
    });
  }

  if (!options._id) {
    throw new Error('No "_id" provided for GridFS file. Filenames are not unique.');
  }

  if (options.root && self.root !== options.root) {
    throw new Error('Root name of Grid object cannot be changed: ' + options.root + " !== " + self.root);
  }

  options.root = self.root;

  if (!self._locks) {
    this.createLockCollection(options, function(err) {
      if (err) { return callback(err); }
      lockAndRead();
    });
  } else {
    lockAndRead();
  }
}

/**
 * The collection used to store file data in mongodb.
 * @return {Collection}
 */

Object.defineProperty(Grid.prototype, 'files', {
  get: function () {
    var self = this;
    if (self._col) return self._col;
    return self._col = self.db.collection(self.root + ".files");
  }
});

/**
 * The collection used to store lock data in mongodb.
 * @return {Collection}
 */

// Add a property for the locks collection?  Probably.

Object.defineProperty(Grid.prototype, 'locks', {
  get: function () {
    var self = this;
    if (self._locks) {
      return self._locks.collection;
    } else {
      return self.db.collection(root + ".locks");
    }
  }
});

/**
 * Removes a file by passing any options with an _id
 *
 * @param {Object} options
 * @param {Function} callback
 */

Grid.prototype.remove = function (options, callback) {
  var self = this;

  if (!options._id) {
    throw new Error('No "_id" provided for GridFS file. Filenames are not unique.');
  }
  var _id = self.tryParseObjectId(options._id) || options._id;

  function lockAndRemove() {
    var lock = new Lock(options._id, self._locks, options);
    lock.obtainWriteLock(function (err, l) {
      if (err) { return callback(err); }
      if (!l) {
        return callback(null);
      }
      self.mongo.GridStore.unlink(self.db, _id, options, function (err) {
        lock.releaseLock(function (err2) {
          if (err2) {
            console.warn('Warning! releaseLock() failed for GridFS ' + self.root + " _id " + options._id);
          }
          if (err || err2) {
          	callback(err || err2);
          } else {
          	callback(null, true);
          }
        });
      });
    });
  }

  if (options.root && self.root !== options.root) {
    throw new Error('Root name of Grid object cannot be changed: ' + options.root + " !== " + self.root);
  }
  options.root = self.root;

  if (!self._locks) {
    this.createLockCollection(options, function(err) {
      if (err) { return callback(err); }
      lockAndRemove();
    });
  } else {
    lockAndRemove();
  }
}

/**
 * Attemps to parse `string` into an ObjectId
 *
 * @param {GridReadStream} self
 * @param {String|ObjectId} string
 * @return {ObjectId|Boolean}
 */

Grid.prototype.tryParseObjectId = function tryParseObjectId (string) {
  var self = this;
  try {
    return new self.mongo.BSONPure.ObjectID(string);
  } catch (_) {
    return false;
  }
}

/**
 * expose
 */

module.exports = exports = Grid;
