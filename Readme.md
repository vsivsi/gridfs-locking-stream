# gridfs-locking-stream

[![Build Status](https://travis-ci.org/vsivsi/gridfs-locking-stream.svg)](https://travis-ci.org/vsivsi/gridfs-locking-stream)

Easily stream files to and from MongoDB [GridFS](http://www.mongodb.org/display/DOCS/GridFS) with concurrency safe read/write access.

Because [GridFS is not inherently safe for concurrent accesses to a file](https://jira.mongodb.org/browse/NODE-157), this package adds robust concurrency support to the excellent [gridfs-stream](https://www.npmjs.org/package/gridfs-stream) package by [@aaron](https://www.npmjs.org/~aaron). It is basically gridfs-stream + [gridfs-locks](https://www.npmjs.org/package/gridfs-locks), with a few minor "concurrency friendly" revisions to the gridfs-stream API.

## What's new in version 1.0?

This major revision of gridfs-locking-stream supports [node.js v0.10 "new style" streams](http://nodejs.org/api/stream.html#stream_compatibility_with_older_node_versions). This is accomplished by using the newly updated v1.x version of the [gridfs-stream](https://github.com/aheckmann/gridfs-stream) library, combined with use of the new v2.x native mongodb driver library. One major change in all of this is that the new mongodb v2.x driver restricts write streams so they can no longer append to existing files. This is a bit disappointing because the purpose of this library was to ensure that such operations could be performed safely. However, this library is still useful in handling one remaining case... Ensuring that a file currently being read or written cannot be deleted until the present operation is complete. Without locking this case still has the potential to lead to server crashes or data corruption for readers.

## Install

```
npm install gridfs-locking-stream

npm test
```

## Use

**Note!** If you are already using `gridfs-stream` please read the "Differences from gridfs-stream" section near the bottom of this document for details on the small number of differences between `gridfs-stream` and `gridfs-locking-stream`.

```js
var mongo = require('mongodb');
var Grid = require('gridfs-locking-stream');

// create or use an existing mongodb-native db instance.
// for this example we'll just create one:
var db = new mongo.Db('yourDatabase', new mongo.Server("127.0.0.1", 27017));

// make sure the db instance is open before passing into `Grid`
db.open(function (err) {
  if (err) return handleError(err);
  var gfs = Grid(db, mongo);  // Use the default GridFS root collection "fs"

  // all set!
})
```

The `gridfs-locking-stream` module exports a constructor that accepts an open [mongodb-native](https://github.com/mongodb/node-mongodb-native/) db and the [mongodb-native](https://github.com/mongodb/node-mongodb-native/) driver you are using. _The db must already be opened before calling `createWriteStream` or `createReadStream`._ An optional third parameter allows the root GridFS collection name to be set to something other than the default of `"fs"`.

Now we're ready to start streaming.

### createWriteStream

To stream data to GridFS we call `createWriteStream` passing any options.

```js
gfs.createWriteStream([options], function (error, writestream) {
  if (writestream) {
    fs.createReadStream('/some/path').pipe(writestream);
  } else {
    // Stream couldn't be created because a write lock was not available
  }
});
```

Options may contain zero or more of the following options, for more information see [GridStore](http://mongodb.github.com/node-mongodb-native/api-generated/gridstore.html):
```js
{
    _id: '50e03d29edfdc00d34000001', // a MongoDb ObjectId, a new file is
                                     // created when writing with no _id
    filename: 'my_file.txt',         // a filename, not used as an identifier
    mode: 'w',                       // default value: w+

                                     // possible options: w, w+, or r
    // any other options from the GridStore may be passed too, e.g.:

    chunkSize: 1024,
    content_type: 'plain/text', // For content_type to work properly
                                // set "mode"-option to "w"
    root: 'my_collection',      // If specified, this must match the root name
                                // used to create the Grid object
    metadata: {
                // whatever you want
    },
    aliases: [
                // list of alternative filenames?
    ]
}
```

The created File object is passed in the writeStreams `close` event.

```js
writestream.on('close', function (file) {
  // do something with `file`
  console.log(file.filename);
});
```

### createReadStream

To stream data out of GridFS we call `createReadStream` passing any options, but at least a valid `_id`.

```js
gfs.createReadStream([options], function (error, readstream) {
  if (readstream) {
    readstream.pipe(response);
  } else {
    // Stream couldn't be created because a read lock was not available
  }
});
```

See the options of `createWriteStream` for more information.

To get partial data with `createReadStream`, use `range` option. e.g.
```js
var readstream = gfs.createReadStream({
  _id: '50e03d29edfdc00d34000001',
  range: {
    startPos: 100,
    endPos: 500000
  }
});
```

### remove

Files can be removed by passing options (at least an `_id`) to the `remove()` method.

```js
gfs.remove([options], function (err, result) {
  if (err) { return handleError(err); }
  if (result) {
    console.log('success');
  } else {
    console.log('failed');  // Due to failure to get a write lock
  }
});
```

See the options of `createWriteStream` for more information.

## check if file exists

Check if a file exist by passing options (at least an `_id`) to the `exist()` method.

```js
gfs.exist(options, function (err, found) {
  if (err) return handleError(err);
  found ? console.log('File exists') : console.log('File does not exist');
});
```

See the options of `createWriteStream` for more information.

## Locking options

There are a few additional options and methods that allow locking to be customized and which are used to handle special situations.

Any of the following may be added to the options object passed to `createReadStream`, `createWriteStream` and `remove`:

```js
{
  timeOut: 30,          // secs to poll for an unavailable lock.
                        // Default: Do not poll
  pollingInterval: 5,   // secs between successive attempts to acquire a lock.
                        // Default: 5 sec
  lockExpiration: 300,  // secs until a lock expires in the database
                        // Default: Never expire
  metaData: null        // metadata to store with lock, useful for debugging.
                        // Default: null
}
```

By default, if the appropriate type of lock is not available when `createReadStream`, `createWriteStream` or `remove` are called, then they return immediately with a `null` result. If you wish to automatically poll for the required lock to become available, set the `timeOut` and `pollingInterval` options to appropriate values for your application. If `timeOut` seconds pass without obtaining the required lock, a null result will be returned.

If [deadlocks](https://en.wikipedia.org/wiki/Deadlock) or dead lock-holding processes are an issue for your application, you may find the `lockExpiration` option to be useful. Note that when this option is used, the lock holder is responsible for finishing its use of the stream before the time expires. To support dealing with expirations, the stream will emit `'expired'` and `'expires-soon'` events. Streams are automatically destroyed before the `'expired'` event is emitted. When `'expires-soon'` is emitted, ~10% of the original lock lifetime remains. See `stream.renewLock()` below.

Streams returned by `createReadStream` and `createWriteStream` each have four additional methods which can be used to inspect and change the status of the lock on a stream. Normally the acquisition and releasing of locks will be handled automatically when streams are created and end. However, depending on how the stream is accessed and the lock options being used, some special handling may be necessary.

```js

// Return the lock document for the lock held by this stream
lock_doc = stream.heldLock();

/* The returned lock document format is:

{
  files_id: Id,             // The id of the resource being locked
  expires: lockExpireTime,  // Date(), when this lock will expire
  read_locks: 0,            // Number of current read locks granted
  write_lock: false,        // Is there currently a write lock granted?
  write_req: false,         // Are there one or more write requests?
  reads: 0,                 // Successful read counter
  writes: 0,                // Successful write counter
  meta: null                // Application metadata
}
*/

// When a callback is needed when the lock has been released
// either automatically or manually using stream.releaseLock()
stream.lockReleased(function (e, d) {
  if (e) {
    // handle error
  }
  // d contains the lock document, or null if the lock was
  // already released at the time lockReleased was called.
});


// When a lock needs to be manually released,
// such as when a readstream is not read to the end.
stream.releaseLock(function (e,d) {
  if (e) {
    // handle error
  }
  // d contains the new lock document
});

// When a lockExpiration option is used and more time is needed to finish
// using the stream before the lock expires. Watching the 'expires-soon'
// event provides a way to request more time.
stream.on('expires-soon', function () {
  stream.renewLock(function (e,d) {
    if (e) {
      // handle error
    }
    // d contains the new lock document
  });
});
```

For more information on the locking implementation, see the documentation for the [gridfs-locks](https://www.npmjs.org/package/gridfs-locks) package.

## accessing file and lock metadata

All file meta-data (file name, upload date, contentType, etc) are stored in a special mongodb collection separate from the actual file data. This collection can be queried directly:

```js
  var gfs = Grid(conn.db);
  gfs.files.find({ filename: 'myImage.png' }).toArray(function (err, files) {
    if (err) ...
    console.log(files);
  });
```

The lock documents for the files in a collection can also be accessed:

```js
  var gfs = Grid(conn.db);
  gfs.locks.findOne({ files_id: '50e03d29edfdc00d34000001' },
    function (err, doc) {
      if (err) ...
      console.log(doc);
  });
```

## Differences from gridfs-stream

If you use gridfs-stream but need [concurrency safe access to GridFS files](https://jira.mongodb.org/browse/NODE-157), you'll be pleased to learn that the API of gridfs-locking-stream is about 97% the same. Both libraries use gridfs-stream's underlying `ReadStream` and `WriteStream` classes, and gridfs-locking-stream passes the gridfs-stream unit tests, with a few changes needed to accommodate the small number of API differences.

For example:

```js
var mongo = require('mongodb');
var Grid = require('gridfs-stream');
var gfs = Grid(db, mongo);

// streaming to gridfs
gfs.createWriteStream({ filename: 'my_file.txt' },  // A fileID will be
                                                    // created automatically
  function (err, writestream) {
    // Handle errors, etc.
    fs.createReadStream('/some/path').pipe(writestream);
  }
 );

// streaming from gridfs
gfs.createReadStream({ _id: '50e03d29edfdc00d34000001' },
  function (err, readstream) {
    // Handle errors, etc.
    readstream.pipe(fs.createWriteStream('/some/path'))
              .on('error', function (err) {
                console.log('An error occurred!', err);
                throw err;
              });
  }
);
```

The first thing to notice in the above code snippet is that the `createXStream` methods require callbacks in gridfs-locking-stream whereas they don't in gridfs-stream. This is to allow for initializing the locks collection as necessary.

One of the main differences from gridfs-stream is that you must create a read stream using a file's unique `_id` (not a filename). This is because filenames aren't required to be unique within a GridFS collection, and so robust locking based on filenames alone isn't possible. Likewise, if you want to append to, overwrite or delete an existing file, you also need to use an `_id`. The only case where omitting the `_id` is okay is when a new file is being written (because in this case a new `_id` is automatically generated.) As an aside, it was never good practice for most applications to use filenames as identifiers for GridFS, so this change is probably for the best. You can easily find a file's `_id` by filename (or any other metadata) by using the Grid's `.files` mongodb collection:

```js
gfs.files.findOne({"filename": "my_file.txt"}, {"_id":1}, function(e, d) {
  if (e || !d) {
    // error or file not found
  } else {
    fileID = d._id;
  }
});
```

The other main difference from gridfs-stream is that each instance of `Grid` is tied to a specific named GridFS collection when it is created, and this cannot be changed during the `Grid` object's lifetime. This change is necessary to associate the correct [gridfs-locks](https://www.npmjs.org/package/gridfs-locks) collection with each instance of `Grid`. In gridfs-locking-stream, the `Grid` constructor function can take an optional third parameter to specify a GridFS collection root name that is different from the default of `"fs"`:

     gfs = Grid(db, mongo, "myroot");

gridfs-stream allowed the GridFS collection to be changed on-the-fly using either the `{ root: "myroot" }` option when streams are created, or by using the `Grid.collection('myroot')` method to change the default collection. In gridfs-locking-stream the `.collection()` method has been eliminated and attempting to create a stream with a `{ root: "myroot" }` option that is different from the `Grid` object's initial root name will throw an error. If access to multiple GridFS collections is required, simply create multiple `Grid` object instances.


## using with mongoose

```js
var mongoose = require('mongoose');
var Grid = require('gridfs-locking-stream');

var conn = mongoose.createConnection(..);
conn.once('open', function () {
  var gfs = Grid(conn.db, mongoose.mongo);

  // all set!
})
```

You may optionally assign the driver directly to the `gridfs-locking-stream` module so you don't need to pass it along each time you construct a grid:

```js
var mongoose = require('mongoose');
var Grid = require('gridfs-locking-stream');
Grid.mongo = mongoose.mongo;

var conn = mongoose.createConnection(..);
conn.once('open', function () {
  var gfs = Grid(conn.db);

  // all set!
})
```

[LICENSE](https://github.com/vsivsi/gridfs-locking-stream/blob/master/LICENSE)
