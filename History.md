### 1.1.1

* Fixed event listener memory leak when renewing locks

### 1.1.0

* Added stream.lockReleased() call to read and write stream objects
* Fixed JSLint issues
* Updated npm dependencies

### 1.0.5

* Added Travis CI automated Testing
* Updated npm dependencies
* Fixed license ID in package file

## v1.0.4

* Bumped version of gridfs-locks package

## v1.0.3

* Fixed bug that squelched future lock events when a callback function was provided to `stream.renewLock()`

## v1.0.2

* Updated to use gridfs-locks v1.3.2 and node.js mongodb native driver v2.0.21

## v1.0.1

* Updated to use gridfs-locks v1.3.1 and node.js mongodb native driver v2.0.19


## v1.0.0

* Updated to use gridfs-stream v1.1 and node.js mongodb native driver v2.x. These changes implement node.js "new style" streams as introdiced in node.js v0.10
* Updated to gridfs-locks 1.3 to provide support for the mongodb native driver v2.x

## v0.2.6

* Removed duplicate end/close event warnings, and replaced them with lock expiration warnings
* Updated unit test dependencies to respect semantic versions

## v0.2.5

*     Updated dependencies to require newer version of gridfs-stream that fixes important bugs

## v0.2.4

*     Fixed bug preventing proper unlocking of read streams introduced in last version

## v0.2.3

*     Don't attempt release of unheld locks on multiple `close` or 'end' events. Thanks to @ceari for reporting issue.
*     Updated to gridfs-locks v1.2.2
*     Updated mongodb to 1.4.12

## v0.2.2

*     Bumped gridfs-streams v0.5.1

## v0.2.1

*     Bumped gridfs-locks to v1.2.1

## v0.2.0

*     Upgraded to gridfs-streams 0.5, added range read support, support for file existance queries, associated tests
*     Fixed issues with streams always automatically closing properly when locks expire, added corresponding tests
*     Documentation updates / improvements

## v0.1.7

*     Bumped gridfs-locks to 1.2.0 to provide improved performance for MongoDB 2.6

## v0.1.6

*     Bumped gridfs-locks required version to fix another mongo 2.4.x issue

## v0.1.5

*     Bumped gridfs-locks required version to fix mongo 2.4.x issue

## v0.1.4

*     Bumped gridfs-locks required version

## v0.1.3

*     Updated documentation to improve formatting of code blocks on npmjs.org

## v0.1.2

*     Updated documentation to reflect use of callbacks for createReadStream and createWriteStream

## v0.1.1

*     Updated to use gridfs-locks v1.0.1

## v0.1.0

*     Updated to work with gridfs-locks v1.0.0
*     Adds events on streams to better handle lock expirations

## Versions 0.0.1 - 0.0.3

*     Initial commit of locking capabilities and various documentation fixes
