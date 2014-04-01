# gridfs-locking-stream

Easily stream files to and from MongoDB [GridFS](http://www.mongodb.org/display/DOCS/GridFS) with concurrency safe read/write access.

This package is necessary because [GridFS is not inherently safe for concurrent accesses to a file](https://jira.mongodb.org/browse/NODE-157). The robust concurrency support this package adds uses a distributed multiple-reader/exclusive-writer model for locking, with fair write-requests to prevent starvation by heavy reader traffic. You can read more about how it works in the [gridfs-locks](https://www.npmjs.org/package/gridfs-locks) package documentation. This package is a slightly modified, concurrency friendly modification of the API from the excellent [gridfs-stream](https://www.npmjs.org/package/gridfs-stream) package by [@aaron](https://www.npmjs.org/~aaron).

## install

```
npm install gridfs-locking-stream

npm test
```

## Differences from gridfs-stream

If you use gridfs-stream but need [concurrency safe access to GridFS files](https://jira.mongodb.org/browse/NODE-157), you'll be pleased to learn that the API of gridfs-locking-stream is about 97% the same. Both libraries use gridfs-stream's underlying `ReadStream` and `WriteStream` classes, and gridfs-locking-stream passes the gridfs-stream unit tests, with a few changes needed to accommodate a small number of API differences.

For example:

```js
var mongo = require('mongodb');
var Grid = require('gridfs-stream');
var gfs = Grid(db, mongo);

// streaming to gridfs
var writestream = gfs.createWriteStream({
    filename: 'my_file.txt'    // A fileID will be automatically created
});
fs.createReadStream('/some/path').pipe(writestream);

// streaming from gridfs
var readstream = gfs.createReadStream({
  _id: '50e03d29edfdc00d34000001'
});

// error handling, e.g. file does not exist
readstream.on('error', function (err) {
  console.log('An error occurred!', err);
  throw err;
});

readstream.pipe(response);
```

One of the main differences from gridfs-stream is that you must create a `ReadStream` using a file's unique `_id` (not a filename). This is because filenames aren't required to be unique within a GridFS collection, and so robust locking based on filenames alone isn't possible. Likewise, if you want to modify (append/overwrite) or delete a file, you also need to use an `_id` for the same reasons. As an aside, it was never a good practice for most applications to use filenames as identifiers in GridFS, and so this change is for the best. You can easily find a file's `_id` by filename (or any other metadata) by using the Grid's `.files` mongodb collection:

```js
gfs.files.findOne({"filename": "my_file.txt"}, {‘_id’:1}, function(e, d) {
  if (e || !d) {
    // error or file not found
  } else {
    fileID = d._id;
  }
});

```

The other main difference from gridfs-stream is that each instance of `Grid` is tied to a given named GridFS collection when it is created, and this cannot be changed during the object's lifetime. This change is necessary to associate the correct [gridfs-locks](https://www.npmjs.org/package/gridfs-locks) collection with each instance of `Grid`. In gridfs-locking-stream, the `Grid` constructor function can take an optional third parameter to specify a GridFS collection root name that is different from the default (`"fs"`):

     gfs = Grid(db, mongo, "myroot");

gridfs-stream allows the GridFS collection to be changed on-the-fly using either the `{ root: "myroot" }` option when streams are created, or by using the `Grid.collection('myroot')` method to change the default collection. In gridfs-locking-stream the `.collection()` method is eliminated and attempting to create a stream with a `{ root: "myroot" }` option that is different from the `Grid` object's initial root with produce an error. If access to multiple GridFS collections is required, simply create multiple `Grid` object instances.

## use

```js
var mongo = require('mongodb');
var Grid = require('gridfs-stream');

// create or use an existing mongodb-native db instance.
// for this example we'll just create one:
var db = new mongo.Db('yourDatabaseName', new mongo.Server("127.0.0.1", 27017));

// make sure the db instance is open before passing into `Grid`
db.open(function (err) {
  if (err) return handleError(err);
  var gfs = Grid(db, mongo);  // Use the default GridFS root collection name "fs"

  // all set!
})
```

The `gridfs-locking-stream` module exports a constructor that accepts an open [mongodb-native](https://github.com/mongodb/node-mongodb-native/) db and the [mongodb-native](https://github.com/mongodb/node-mongodb-native/) driver you are using. _The db must already be opened before calling `createWriteStream` or `createReadStream`._ An optional third parameter allows the root GridFS collection name to be set to something other than the default of `"fs"`.

Now we're ready to start streaming.

## createWriteStream

To stream data to GridFS we call `createWriteStream` passing any options.

```js
var writestream = gfs.createWriteStream([options]);
if (writestream) {
  fs.createReadStream('/some/path').pipe(writestream);
} else {
  // Stream couldn't be created because a write lock was not available
}
```

Options may contain zero or more of the following options, for more information see [GridStore](http://mongodb.github.com/node-mongodb-native/api-generated/gridstore.html):
```js
{
    _id: '50e03d29edfdc00d34000001', // a MongoDb ObjectId, if omitted a new file will always be created
    filename: 'my_file.txt', // a filename, not used as an identifier
    mode: 'w', // default value: w+, possible options: w, w+, or r, see [GridStore](http://mongodb.github.com/node-mongodb-native/api-generated/gridstore.html)

    // any other options from the GridStore may be passed too, e.g.:

    chunkSize: 1024,
    content_type: 'plain/text', // For content_type to work properly, set "mode"-option to "w" too!
    root: 'my_collection',  // If specified, this must match the root name used to create the Grid object
    metadata: {
        // ...
    }
}
```

The created File object is passed in the writeStreams `close` event.

```js
writestream.on('close', function (file) {
  // do something with `file`
  console.log(file.filename);
});
```

## createReadStream

To stream data out of GridFS we call `createReadStream` passing any options, at least an `_id`.

```js
var readstream = gfs.createReadStream(options);
if (readstream) {
  readstream.pipe(response);
} else {
  // Stream couldn't be created because a read lock was not available
}
```

See the options of `createWriteStream` for more information.

## removing files

Files can be removed by passing options (at least an `_id`) to the `remove()` method.

```js
gfs.remove(options, function (err, result) {
  if (err) return handleError(err);
  if (result) console.log('success');
});
```

See the options of `createWriteStream` for more information.

## Locking options

There are a few additional options and methods to allow locking to be customized and which are used to handle special situations. 

Any of the following may be added to the options object passed to `createReadStream`, `createWriteStream` and `remove`:

```js
{
  timeOut: 30,          // seconds to poll when obtaining a lock that is not available.  Default: Do not poll
  pollingInterval: 5,   // seconds between successive attempts to acquire a lock while waiting  Default: 5 sec
  lockExpiration: 300,  // seconds until a lock expires in the database  Default: Never expire
  metaData: null        // metadata to store in the lock documents, useful for debugging  Default: null
}

```

By default, if the appropriate type of lock is not available when `createReadStream`, `createWriteStream` or `remove` are called, then they return immediately with a `null` result. If you wish to automatically poll for the required lock to become available, set the `timeOut` and `pollingInterval` options to the appropriate values for your application. If the timeOut period passes without obtaining the required lock, a null result will be returned.

If [deadlock](https://en.wikipedia.org/wiki/Deadlock) or dying lock-holding processes are an issue for your application, you may find the `lockExpiration` option to be useful. Note that when this operation is used, the lock holder is responsible for finishing its use of the stream before the time expires. See `stream.renewLock()` below.

Streams returned by `createReadStream` and `createWriteStream` each have three additional methods which can be used to inspect and change the status of the lock on a stream. Normally the acquisition and releasing of locks will be handled automatically when streams are created and end. However, depending on how the stream is accessed and the lock options being used, some special handling may be necessary.

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

// When a lock needs to be manually released, such as when a readstream is not read to the end.
stream.releaseLock(function (e,d) {
  if (e) {
    // handle error
  };
  // d contains the new lock document
});

// When a lockExpiration option is used and more time is needed to finish using the stream before the lock expires.
stream.renewLock(function (e,d) {
  if (e) {
    // handle error
  };
  // d contains the new lock document
});

```

For more information on the topics below, see the documentation for the [gridfs-locks](https://www.npmjs.org/package/gridfs-locks) package.

## accessing file metadata

All file meta-data (file name, upload date, contentType, etc) are stored in a special mongodb collection separate from the actual file data. This collection can be queried directly:

```js
  var gfs = Grid(conn.db);
  gfs.files.find({ filename: 'myImage.png' }).toArray(function (err, files) {
    if (err) ...
    console.log(files);
  })
```

## using with mongoose

```js
var mongoose = require('mongoose');
var Grid = require('gridfs-stream');

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
