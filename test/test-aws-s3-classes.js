/*global require, module, describe, it, suite */
"use strict";
var assert = require("chai").assert;
var AWS = require('aws-sdk');
var awsSetup = require('./awssetup.js');
var AWSWrapper = require('../lib/aws-s3-classes.js');


var s3 = new AWS.S3();


describe('AWS Wrapper Tests', function () {
    before('deleting and recreating test bucket', function () {
        return awsSetup.cleanup(s3)
            .then(function () {
                return awsSetup.createTestBucket(s3);
            });
    });

    after('deleting test bucket', function () {
        return awsSetup.cleanup(s3);
    });

    describe('Class Constructor Tests', function () {

        it("Copy constructor throws an exception if an s3 parm is not passed", function (done) {
            assert.throw(function () {
                new AWSWrapper.Copy();
            }, "");
            done();
        });


        it("Del constructor throws an exception if an s3 parm is not passed", function (done) {
            assert.throw(function () {
                new AWSWrapper.Del();
            }, "");
            done();
        });

        it("Get constructor throws an exception if an s3 parm is not passed", function (done) {
            assert.throw(function () {
                new AWSWrapper.Get();
            }, "");
            done();
        });

        it("List constructor throws an exception if an s3 parm is not passed", function (done) {
            assert.throw(function () {
                new AWSWrapper.List();
            }, "");
            done();
        });

        it("Put constructor throws an exception if an s3 parm is not passed", function (done) {
            assert.throw(function () {
                new AWSWrapper.Put();
            }, "");
            done();
        });

    });


    describe('Copy Get, List, Put and Delete tests ', function () {
        step('After setup there should no be no objects in the test bucket', function () {
            let config = {Bucket: awsSetup.TEST_BUCKET};
            return new AWSWrapper.List(s3).listObjects(config)
                .then(function (data) {
                    assert.equal(data.length, 0);
                });
        });

        // Add an object called test1.txt to the bucket and verify it exists
        step('Put,List: Putting an object in the bucket should result in one object in the list', function () {
            let config = {Bucket: awsSetup.TEST_BUCKET, Key: 'test1.txt'};
            // Write the object to the test bucket
            return new AWSWrapper.Put(s3).writeObjectFromLocalFile(config, awsSetup.LOCAL_FILENAME)
                .then(function () {
                    // List the bucket contents. It should contain one object with our filename
                    return new AWSWrapper.List(s3).listObjects({
                        Bucket: awsSetup.TEST_BUCKET,
                        Prefix: 'test1.txt'
                    })
                        .then(function (data) {
                            assert.equal(data.length, 1, 'array of listObjects');
                            assert.equal(data[0].Key, 'test1.txt', 'Test Key Name');
                        });
                });
        });

        // After the prior test, we have one object in the test bucket with the name test1.txt
        // Now copy that object to a new object called test2.txt

        step('Copy,List: Copying the original object, should result in 2 objects in the bucket', function () {
            let config = {
                Bucket: awsSetup.TEST_BUCKET,
                Key: 'test2.txt',
                CopySource: `${awsSetup.TEST_BUCKET}/test1.txt`
            };
            return new AWSWrapper.Copy(s3).copyObject(config)
                .then(function () {
                    return new AWSWrapper.List(s3).listObjects({Bucket: awsSetup.TEST_BUCKET})
                        .then(function (data) {
                            assert.equal(data.length, 2, 'array of objects');
                        });
                });
        });

        // Now we have test1.text and test2.txt in our bucket.

        step('Get: Get the contents of both files', function () {
            let config = [
                {   Bucket: awsSetup.TEST_BUCKET,
                    Key: 'test1.txt' },
                {   Bucket: awsSetup.TEST_BUCKET,
                    Key: 'test2.txt' }
            ];
            return new AWSWrapper.Get(s3).getObjects(config)
                .then(function (data) {
                    assert.equal(data.length, 2);
                    assert.equal(data[0].Key, 'test1.txt');
                    assert.equal(data[1].Key, 'test2.txt');
                    return Promise.resolve();
                });
        });


        // Delete test2.txt and verify
        step('Delete,List: Deleting the copied object, should result in 1 object in the bucket', function () {
            let config = {
                Bucket: awsSetup.TEST_BUCKET,
                Key: 'test2.txt'
            };
            return new AWSWrapper.Del(s3).deleteObject(config)
                .then(function () {
                    return new AWSWrapper.List(s3).listObjects({Bucket: awsSetup.TEST_BUCKET})
                        .then(function (data) {
                            assert.equal(data.length, 1, 'array of objects');
                        });
                });
        });

        // Get the contents of test1.txt in a buffer and compare the size and contents to the original
        step('Get: Get the contents of the object and verify', function () {
            let config = {
                Bucket: awsSetup.TEST_BUCKET,
                Key: 'test1.txt'
            };
            return new AWSWrapper.Get(s3).getObject(config)
                .then(function (data) {
                    assert.equal(data.Body.length, awsSetup.FILE_CONTENTS.length, '');
                    assert.equal(data.Body.toString('utf8'), awsSetup.FILE_CONTENTS, '');
                });
        });

        // Write the contents of the temp file created above to an object, get it and compare the contents
        step('Get-writeObjectToLocalFile, Get: Write the contents of a an object to a local file, get it and verify', function () {
            let config = {
                Bucket: awsSetup.TEST_BUCKET,
                Key: 'test1.txt'
            };
            return new AWSWrapper.Get(s3).writeObjectToLocalFile(config, awsSetup.TEMP_FILENAME)
                .then(function (data) {
                    return new AWSWrapper.Get(s3).getObject(config)
                        .then(function (data) {
                            assert.equal(data.Body.length, awsSetup.FILE_CONTENTS.length, '');
                            assert.equal(data.Body.toString('utf8'), awsSetup.FILE_CONTENTS, '');
                        });

                });
        });

        step('Put-writeObjectFromLocalFile, Get: Write the contents of local file to an object and verify', function () {
            let config = {
                Bucket: awsSetup.TEST_BUCKET,
                Key: 'test3.txt'
            };
            return new AWSWrapper.Put(s3).writeObjectFromLocalFile(config, awsSetup.TEMP_FILENAME)
                .then(function (data) {
                    return new AWSWrapper.Get(s3).getObject(config)
                        .then(function (data) {
                            assert.equal(data.Body.length, awsSetup.FILE_CONTENTS.length, '');
                            assert.equal(data.Body.toString('utf8'), awsSetup.FILE_CONTENTS, '');
                        });

                });
        });


        // Exercise the deleteAll function
        step('DeleteAll, List: Send an array of objects to delete, should result in 0 objects in the bucket', function () {
            let config = {
                Bucket: awsSetup.TEST_BUCKET,
                Delete: { Objects: [
                    {Key: 'test1.txt'},
                    {Key: 'test3.txt'} ] }
            };
            return new AWSWrapper.Del(s3).deleteObjects(config)
                .then(function () {
                    return new AWSWrapper.List(s3).listObjects({Bucket: awsSetup.TEST_BUCKET})
                        .then(function (data) {
                            assert.equal(data.length, 0, 'array of objects');
                        });
                });
        });

    });


});



