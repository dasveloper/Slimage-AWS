'use strict';

const http = require('http');
const https = require('https');
const querystring = require('querystring');

const AWS = require('aws-sdk');
const S3 = new AWS.S3({
  signatureVersion: 'v4',
});
const Sharp = require('sharp');

// set the S3 and API GW endpoints
const BUCKET = 'image-resize-927385896375-us-east-1';

exports.handler = (event, context, callback) => {
  let response = event.Records[0].cf.response;

  console.log("Response status code :%s", response.status);

  //check if image is not present
  if (response.status == 404) {

    let request = event.Records[0].cf.request;
    let params = querystring.parse(request.querystring);

    // if there is no dimension attribute, just pass the response
    if (!params.d) {
      callback(null, response);
      return;
    }

    // read the dimension parameter value = width x height and split it by 'x'
    let dimensionMatch = params.d.split("x");

    // read the required path. Ex: uri /images/100x100/webp/image.jpg
    let path = request.uri;
    console.log("path: " + path);
    // read the S3 key from the path variable.
    // Ex: path variable /images/100x100/webp/image.jpg
    let key = path.substring(1);
    console.log(key);

    // parse the prefix, width, height and image name
    // Ex: key=images/200x200/webp/image.jpg
    let prefix, originalKey, match, width, height, requiredFormat, imageName, extension;
    let startIndex;

    try {
      match = key.match(/(.*)\/(\d+)\/(.*)\.(.*)/);
      prefix = match[1];
      width = parseInt(match[2], 10);
      height = null;

      // correction for jpg required for 'Sharp'
      //requiredFormat = match[4] == "jpg" ? "jpeg" : match[4];
      imageName = match[3];
      extension = match[4].toLowerCase();

      switch (extension) {
          case "jpg":
          case "jpeg":
              extension = "jpeg";
              break;
          case "png":
              extension = "png";
              break;
          case "webp":
              extension = "webp";
              break;
          case "tiff":
              extension = "tiff";
              break;
          case "gif":
          case "svg":
              extension = "png";
              break;
      }
      originalKey = prefix + "/" + imageName +"." +match[4] ;
    }
    catch (err) {
      // no prefix exist for image..
      console.log("no prefix present..");
    }
   let decodedKey =  decodeURI(originalKey);
    // get the source image file
    S3.getObject({ Bucket: BUCKET, Key: decodedKey }).promise()
      // perform the resize operation
      .then(data => Sharp(data.Body)
        .resize(width, height, { kernel: 'cubic' })
        .jpeg({ quality: 100, force: false })
        .png({ compressionLevel: 9, force: false })
        .webp({ quality: 100, force: false })
        .tiff({ quality: 100, force: false })

        .toFormat(extension)
        .toBuffer()
      )
      .then(buffer => {
        // save the resized object to S3 bucket with appropriate object key.
        S3.putObject({
            Body: buffer,
            Bucket: BUCKET,
            ContentType: 'image/'+extension,
            CacheControl: 'max-age=31536000',
            Key: key,
            StorageClass: 'STANDARD'
        }).promise()
        // even if there is exception in saving the object we send back the generated
        // image back to viewer below
        .catch(() => { console.log("Exception while writing resized image to bucket")});

        // generate a binary response with resized image
        response.status = 200;
        response.body = buffer.toString('base64');
        response.bodyEncoding = 'base64';
        response.headers['cache-control'] = [{ 
          key:   'Cache-Control', 
          value: 'public, max-age=86400' 
      }];
        response.headers['content-type'] = [{ key: 'Content-Type', value: 'image/' + extension }];
        callback(null, response);
      })
    .catch( err => {
      console.log("Exception while reading source image :%j",err);
    });
  } // end of if block checking response statusCode
  else {
    // allow the response to pass through
    callback(null, response);
  }
};
