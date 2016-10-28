#AWS S3 Classes
_A set of promise enabled, ES6 Classes for applying common AWS S3 methods._

[![Inline docs](http://inch-ci.org/github/wildbillh/serialized-array-runner.svg?branch=master)](http://inch-ci.org/github/wildbillh/serialized-array-runner)[![npm version](https://badge.fury.io/js/serialized-array-runner.svg)](https://badge.fury.io/js/serialized-array-runner)

##Class and Method Summary
Class   | Methods Supported
--------|---------------------
Copy    | copyObject
Del     | deleteObject, deleteObjects
Get     | getObject, getObjects\*, writeObjectToLocalFile\*
List    | listObjects\*\*
Put     | writeObjectFromLocalFile\*

_\* Not available from AWS S3_

_\*\* Available from AWS S3, but highly augmented_

##Synopsis

Retrieve a list of S3 objects into memory:

```javascript
let s3 = require('aws-sdk').S3();
let Get = require('aws-s3-classes').Get;
let getConfig = [
    {Bucket: 'bucket', Key: 'object1', 
    {Bucket: 'bucket', Key: 'object2'}
];

// Call the getObjects method to retrieve the objects given into memory. 
// Notice the second parm is the number of parallel threads to use. 
// Use a value of 1 to get the objects serially.
new Get(s3).getObjects(getConfig, 2)
    .then( (results) => {
        console.log(results); 
        // We'll get back an array of 2 objects, assuming they were found
        /*
        [   {Bucket: 'bucket', Key: 'object1', Body: <buffer> ...},
            {Bucket: 'bucket', Key: 'object2', Body: <buffer> ...}]
        */    
    });
```

Write an S3 object to a local file

```javascript
let s3 = require('aws-sdk').S3();
let Get = require('aws-s3-classes').Get;
let getConfig = {Bucket: 'bucket', Key: 'object1'};

// Write the data in the given S3 object to a local file
new Get(s3).writeObjectToLocalFile(getConfig, 'my-filename.txt')
    .then( (results) => {
        console.log(results); 
        // The file will be written and results will contain: 
        /*
        {Config: {Bucket: 'bucket', Key: 'object1'}, 
        Filename: 'my-filename.txt'};
        */    
    });
```

Write a local file to an S3 object

```javascript
let s3 = require('aws-sdk').S3();
let Put = require('aws-s3-classes').put;
let putConfig = {Bucket: 'bucket', Key: 'object1'};

// Write the contents of a local file to an S3 Object
new Put(s3).writeObjectFromLocalFile(getConfig, 'my-filename.txt')
    .then( (results) => {
        console.log(results); 
        // The object will be created. Sample results object below: 
        /*
        { ETag: '"0b3410642200aa8ca4515c53f16201dc"',
          Bucket: 'bucket',
          Key: 'object1' }
        */    
    });
```

##Description
These classes exist to simplify the code used for some commonly used
AWS S3 functions. 
Some of the methods are boilerplate S3, but many add considerable value
to the stock calls. 

**Here are the value-add highlights:**
* Get and Put include streaming file handling
* List uses a generator to call listObjectsV2 multiple times, to fulfill the request.
* Get.getObjects allows the user to combine serial and parallel calls.

The last item is probably the most interesting implementation. 
It allows the user to get multiple objects in one shot and control the
number of threads used. This is very convenient when you have a large 
list of small objects that you want to retrieve to memory.

##Project Features
* ES6 Class
* Promise enabled
* Complete test coverage with Mocha and Chai
* JSDoc generated API documentation

##Installation
npm install aws-s3-classes --save

Git Repository: https://github.com/wildbillh/aws-s3-classes

##Documentation
API Documentation: [aws-s3-classes](doc/module-aws-s3-classes.html)