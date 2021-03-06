
//noinspection JSValidateJSDoc
/**
 * Provides a class interface for some of the common AWS S3 functions.<br/>
 * All methods return a promise.<br/>
 * Some of the methods are boilerplate S3, but
 * many add considerable value to the stock calls.<br/>
 * Here are the value-added highlights:
 * <ul>
 * <li>Get and Put include streaming file handling</li>
 * <li>List uses a generator to call listObjectsV2 multiple times, if necessary.</li>
 * <li>Probably the most interesting implementation is Get.getObjects(). It
 * allows the user to get multiple objects in one shot and control the
 * number of threads used. This is very convenient when you have a large list of small
 * objects that you want to retrieve to memory.</li>
 * </ul>
 * The config object sent to each method is the same as the like AWS S3 call. Likewise
 * return data is usually the same object(s) return by the AWS S3 calls, but in a few cases
 * I add additional properties.<br/><br/>
 * Author: Bill Hodges
 * @module aws-s3-classes
 */



"use strict";
let fs = require('fs');
let HybridArrayRunner = require('hybrid-array-runner');


/**
 * Function for combining a function and it's arguments into a single argument for passing.
 * @param func
 * @returns {Function}
 * @private
 */
function partial(func /*, 0..n args */) {
    let args = Array.prototype.slice.call(arguments).splice(1);
    return function () {
        let allArguments = args.concat(Array.prototype.slice.call(arguments));
        return func.apply(this, allArguments);
    };
}


/**
 * Runs a generator to completion.
 * Each then'ed result is pushed into an array and a promise is returned
 * containing this array.
 * On Error, an exception is thrown, stopping the generator and returning
 * a rejected promise.
 * Copied from Kyle Simpson. The only addition is the accumulated array of results.
 * @type {function()}
 * @private
 */
function runWithConcatenatedResults (gen)  {
    let args = [].slice.call( arguments, 1), it;
    let retArray = [];
    // initialize the generator in the current context
    it = gen.apply( this, args ); // jshint ignore:line

    // return a promise for the generator completing
    return Promise.resolve()
        .then( function handleNext(value){
            // run to the next yielded value
            // For the first call, value is undefined
            if (value) {
                retArray.push(value);
            }
            let next = it.next( value );

            return (function handleResult(next){
                // generator has completed running?
                //noinspection JSUnresolvedVariable
                if (next.done) {
                    return retArray;
                }
                // otherwise keep going
                else {
                    return Promise.resolve( next.value )
                        .then(
                            // resume the async loop on
                            // success, sending the resolved
                            // value back into the generator
                            handleNext,

                            // if `value` is a rejected
                            // promise, propagate error back
                            // into the generator for its own
                            // error handling
                            function handleErr(err) {
                                return Promise.resolve(
                                    it.throw( err )
                                )
                                    .then( handleResult );
                            }
                        );
                }
            })(next);
        } );
}


/**
 * Class for encapsolating the copying of objects (files) in Amazon's S3.
 * Adds support for ES6 Promises.
 */
class Copy {
    /**
     * Class constructor
     * @param {object} s3 valid Amazon s3 object
     */
    constructor (s3) {
        // Test to see if they sent an object and it appears to be an AWS object
        if (!s3 || (typeof s3 !== 'object') || !s3.hasOwnProperty('config')) {
            throw new Error("AWSCopyObject(): Must supply valid AWS S3 config in constructor");
        }
        this.s3Object = s3;
    }

    // -----------------------------------------------------------------------------------
    /**
     * Called with the AWS config parameter used by the s3.copyObject method.
     * If the promise if fulfilled, the object
     * was copied.
     * @param {object} config Valid AWS.copyObject config object
     * @param {string} config.Bucket Target Bucket
     * @param {string} config.CopySource Source (Bucket/Key)
     * @param {string} config.Key Target Key
     * @returns {Promise} The resolved data contains an object. See the S3.copyObject Documentation for details.
     */
    copyObject (config) {
        return this.s3Object.copyObject(config).promise();
    }
}

// ---------------------------------------------------------------------------------------------------------------
/**
 * Class for promisifying AWS delete object call
 */
class Del {
    /**
     * Class constructor
     * @param s3 valid Amazon s3 object
     */
    constructor (s3) {
        // Test to see if they sent an object and it appears to be an AWS object
        if (!s3 || (typeof s3 !== 'object') || !s3.hasOwnProperty('config')) {
            throw new Error("AWSDeleteObject(): Must supply valid AWS S3 config in constructor");
        }
        this.s3Object = s3;
    }

    /**
     * Delete a single object
     * @param config {Object}
     * @param config.Bucket {string} Target Bucket
     * @param config.Key {string} Target Key
     * @returns {Promise} On success, the promise returns an object
     *
     */
    deleteObject (config) {
        return this.s3Object.deleteObject(config).promise();
    }

    /**
     * Delete multiple objects in one shot
     * @param config {Object}
     * @param {string} config.Bucket Target Bucket
     * @param {object} config.Delete contains an object of form: {Objects: [{Key: 'first}, {Key: 'second'}...]}
     * @returns {Promise}
     * <pre>
     * On success, the promise returns on object with an array of the deleted S3 objects:
     * {Deleted: [{Key: 'first'}, {Key: 'last}], Errors: []}
     * </pre>
     *
     */
    deleteObjects (config) {
        return this.s3Object.deleteObjects(config).promise();
    }

}

// -----------------------------------------------------------------------------------------------------------

/**
 * Class for encapsolating the getting of objects in Amazon's S3.
 * Adds support for ES6 Promises.
 */
class Get {
    /**
     * Class constructor
     * @param s3 valid Amazon s3 object
     */
    constructor(s3) {
        // Test to see if they sent an object and it appears to be an AWS object
        if (!s3 || (typeof s3 !== 'object') || !s3.hasOwnProperty('config')) {
            throw new Error("AWSGetObject(): Must supply valid AWS S3 config in constructor");
        }
        this.s3Object = s3;
        this.returnData = null;
    }



    // -----------------------------------------------------------------------------------
    /**
     * Retrieves the contents of the S3 object and writes it to a local file.
     * This method takes advantage of streaming to minimize memory usage.
     * @param {object} config Valid S3 getObject config
     * @param {string} config.Bucket Target Bucket
     * @param {string} config.Key Target Key
     * @param {string} filename Filepath to be generated locally with the object contents
     * @returns {Promise} When resolved, data is of the form: { Config: {configObject}, Filename: 'filename'}.
     */

    writeObjectToLocalFile (/*object*/config, /*string*/filename) {
        return new Promise((resolve, reject) => {
            if (!config || !config.hasOwnProperty('Bucket')) {
                return reject ({ErrorNumber: 1, message: "Invalid AWS config", Handled: false});
            }
            if (!filename) {
                return reject({ErrorNumber: 2, message: "Filepath string must be supplied", Handled: false});
            }

            let writeStream = fs.createWriteStream(filename)
                .on('error', (error) => {
                    reject({ErrorNumber: 3, message: error.message, Handled: false});
                })
                .on('finish', (data) => {
                    resolve({Config: config, Filename: filename}); // Happy path
                })
                .on('open', () => {
                    //noinspection JSUnresolvedFunction
                    this.s3Object.getObject(config).createReadStream()
                        .on('error', (error) => {
                            reject ({ErrorNumber: 4, message: error.message, Handled: false});
                        })
                        .pipe(writeStream); // Returns a writeStream
                });
        });
    }


    // ----------------------------------------------------------------------------
    /**
     *  Returns the S3 object which includes the data in a buffer. Note that Bucket and Key properties are added to the standard S3 return.
     * @param {object} config
     * @param {string} config.Bucket Target Bucket
     * @param {string} config.Key Target Key
     * @returns {Promise} The resolved object contains a Body object with the object contents as a Node buffer.
     * Bucket and Key properties are by the method for convenience.
     */
    getObject (config) {
        return new Promise( (resolve, reject) => {
            if (!config || !config.hasOwnProperty('Bucket')) {
                reject (new Error("AWSGetObject.getBuffer(): A valid AWS config must be sent"));
            }
            //noinspection JSUnresolvedFunction
            this.s3Object.getObject(config, (error, data) => {
                if (error) {
                    reject(error);
                }
                else {
                    // Add the bucket to the return object
                    data.Bucket = config.Bucket;
                    data.Key = config.Key;
                    resolve(data);
                }
            });
        });
    }

    // -------------------------------------------------------------------------------------------------

    /**
     * Pass in an array of s3.getObject configs and return all of the objects in memory.
     * When dealing with many small objects, it's often useful to do this work with some degree of
     * parallelism (for quicker response). I've found the typical limit to parallel queries is around 300.
     * Setting the value of threads > 1, allows the call to make this many parallel calls at a time.
     * See my HybridArrayRunner class for more information.
     * @param {array} configArray An array of valid S3 getObject configs
     * @param {number} [threads=1] The number of parallel calls to make. Default is 1 (serial)
     * @returns {Promise}
     * When resolved, returns an array of objects. The format is the same as S3.getObject() returns.
     */

    getObjects (configArray, threads = 1) {
        return new HybridArrayRunner(HybridArrayRunner.ARRAY_RETURN, threads).run(configArray, this.getObject, this);
    }

}


//--------------------------------------------------------------------------------------------------------------

/**
 * Class for encapsolating the request for object lists for AWS S3 buckets.
 * Internally adds recursive calls to AWS if the result set is truncated.
 * Adds support for promises.
 * 
 * @author Bill Hodges
 */

class List {
    /**
     * 
     * @param s3 {Object}
     */
    constructor (s3) {
        // Test to see if they sent an object and it appears to be an AWS object
        if (!s3 || (typeof s3 !== 'object') || !s3.hasOwnProperty('config')) {
            throw new Error("Must supply valid AWS S3 config in constructor");
        }
        this.s3Object = s3;
    }

    /**
     * Generator for getting a complete list of Amazon S3 Objects.
     * At most, Amazon only get's 1000 objects per call. This generator
     * checks for a truncated result set and calls the method
     * again until all objects are captured
     * Note that this is using the V2 version of listObjects
     * and no longer supports the Marker tag.
     * @private
     */
    *listObjectsGenerator(s3, listParams) {
        // Get the first set of list objects
        //noinspection JSUnresolvedFunction
        let result = yield s3.listObjectsV2(listParams).promise();

        while (result.IsTruncated) {
            listParams.ContinuationToken = result.NextContinuationToken;
            //noinspection JSUnresolvedFunction
            result = yield s3.listObjectsV2(listParams).promise();
        }
    }

    /**
     * Get the list of list Objects. Internally S3.listObjectsV2 is called multiple times until all
     * objects are consumed. Your welcome!
     * @param {object} config S3 listObjectsV2 config object
     * @returns {Promise}
     * When resolved, returns an array of results. See the S3.listObjectsV2 documentation.
     */
    listObjects (config) {
        return new Promise( (resolve, reject) => {
            if (!config || !config.hasOwnProperty('Bucket')) {
                return reject("ListObjects.get(): A valid AWS config must be sent");
            }
            let returnArray = [];
            /**
             * Utilize the runner to execute the generator. Note the use of the partial
             * function to handle the passed parms to the runner
             */
            runWithConcatenatedResults(partial(this.listObjectsGenerator, this.s3Object, config))
                .then((responseArray) => {
                    // ResponseArray contains an array of AWS listObject return sets.
                    // We might have had to call listObjects multiple times since AWS limits the return to 1000
                    // objects per call.
                    responseArray.forEach( (contentsArray) => {
                        // The Contents property contains an array of 0 - 1000 list objects
                        contentsArray.Contents.forEach( (content) => {
                            // Add the bucket to the returned data for convenience.
                            //console.log('config.Bucket ' + config.Bucket);
                            content.Bucket = config.Bucket;

                            // Add the list object to the returned array
                            returnArray.push(content);
                        });
                    });
                    resolve(returnArray);

                }).catch((err) => {
                reject({config: config, error: err.message});
            });
        });
    }
}

/**
 * Class for encapsolating the putting of data into AWS S3 buckets.
 * Adds support for promises.
 *
 * @author Bill Hodges
 */
class Put {
    constructor (s3) {
        // Test to see if they sent an object and it appears to be an AWS object
        if (!s3 || (typeof s3 !== 'object') || !s3.hasOwnProperty('config')) {
            throw new Error("AWSListBucket(): Must supply valid AWS S3 config in constructor");
        }
        this.s3Object = s3;

    }

    /**
     * Puts the contents of a file into an S3Bucket. This method takes advantage of streaming
     * to avoid memory issues.
     * @param {object} config a typical S3.putObject config
     * @param {string} filepath a valid filepath
     * @returns {Promise}
     * When resolved, returns an object {Etag: 'etag', Bucket: 'bucket', Key: 'key'}
     */
    writeObjectFromLocalFile (config, filepath) {
        return new Promise((resolve, reject) => {

            if (!config || !config.hasOwnProperty('Bucket')) {
                return reject("PutObject.writeFile(): A valid AWS config must be sent");
            }
            // Make a copy of the config object since we'll be modifying it.
            let _config = Object.assign({}, config);

            // Check the given file
            fs.access(
                filepath,
                fs.R_OK,
                (error) => {
                    if (error) {
                        return reject(error);
                    }
                    // Get a readable stream from the filepath and set it to the body of the config.
                    _config.Body = fs.createReadStream(filepath);

                    //noinspection JSUnresolvedFunction
                    this.s3Object.putObject(_config).promise()
                        .then ( (data) => {
                            data.Bucket = config.Bucket;
                            data.Key = config.Key;
                            resolve(data);
                        })
                        .catch( (error) => {
                            reject(error);
                        });
                }
            );


        });
    }
}


module.exports.Copy = Copy;
module.exports.Del = Del;
module.exports.Get = Get;
module.exports.List = List;
module.exports.Put = Put;

