## v0.2.3

*     Don't release unheld locks on `close` events. Thanks to @ceari for reporting issue.

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
