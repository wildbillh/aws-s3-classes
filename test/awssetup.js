

"use strict";
/* jshint esversion: 6*/


var fs = require('fs');
var path = require('path');
var AWS = require('aws-sdk');

// Put your test bucket here to run the test cases.
let TEST_BUCKET = 'my-weirdo-test-bucket-name';
let FILE_CONTENTS = "this is the string I'll use for my file contents";
let LOCAL_FILENAME = 'test/mytest.txt';
let TEMP_FILENAME = 'test/tempfile.txt';


/**
 * Clean up our test bucket
 */
let cleanup = function (s3) {
    return new Promise ( (resolve, reject) => {

        // If there are any files in our test bucket list them out
        //noinspection JSUnresolvedFunction
        s3.listObjects( {Bucket: TEST_BUCKET}).promise()
            .then(function(list) {
                // If the bucket is empty, move on
                if (list.Contents.length === 0) {
                    return Promise.resolve();
                }

                // For each object get an array of Key's
                var contents = [];
                list.Contents.forEach((element) => {
                    contents.push({Key: element.Key});
                });

                // Build a deleteObjects config and execute
                var delObjectsConfig = {Bucket: TEST_BUCKET, Delete: {Objects: contents}};
                return s3.deleteObjects(delObjectsConfig).promise();
            })
            .catch(function () {
                // If this fails it probably means the bucket doesn't exist
                return Promise.resolve();
            })
            .then(function () {
                // Delete the bucket
                return s3.deleteBucket({Bucket: TEST_BUCKET}).promise();
            })
            .then( function () {
                resolve();
            })
            .catch(function () {
                // Same as above the bucket probably doesn't exist
                resolve();
            });
    });

};


let createTestBucket = function (s3) {
    return s3.createBucket({Bucket: TEST_BUCKET}).promise();
};

let createLocalFile = function () {
    fs.writeFileSync(LOCAL_FILENAME, FILE_CONTENTS);    
};

module.exports = {TEST_BUCKET, cleanup, createTestBucket, createLocalFile, LOCAL_FILENAME, FILE_CONTENTS, TEMP_FILENAME};





