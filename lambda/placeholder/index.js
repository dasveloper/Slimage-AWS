"use strict";

const http = require("http");
const https = require("https");
const querystring = require("querystring");

const AWS = require("aws-sdk");
const S3 = new AWS.S3({
  signatureVersion: "v4"
});
const Sharp = require("sharp");

// set the S3 and API GW endpoints
const BUCKET = "image-resize-927385896375-us-east-1";
exports.handler = (event, context, callback) => {
  let width = event.width;
  let height = event.height;
  let type = event.type;
  let apikey = event.apiKey;
  let filename = event.fileName;

  type = type.toLowerCase();
  console.log(type);

  switch (type) {
    case "jpg":
    case "jpeg":
      type = "jpeg";
      break;
    case "png":
      type = "png";
      break;
    case "webp":
      type = "webp";
      break;
    case "tiff":
      type = "tiff";
      break;
    case "gif":
    case "svg":
      type = "png";
      break;
  }
  console.log("image/" + type);
  console.log(apikey + "/placeholder/" + filename);
  console.log(width);
  console.log(height);
  Sharp({
    create: {
      width: width,
      height: height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .toFormat(type)
    .toBuffer()
    .then(buffer => {
      // save the resized object to S3 bucket with appropriate object key.
      console.log("image/" + type);
      console.log(apikey + "/placeholder/" + filename);
      S3.putObject({
        Body: buffer,
        Bucket: BUCKET,
        ContentType: "image/" + type,
        CacheControl: "max-age=31536000",
        Key: apikey + "/placeholder/" + filename,
        StorageClass: "STANDARD"
      })
        .promise()
        // even if there is exception in saving the object we send back the generated
        // image back to viewer below
        .catch(() => {
          console.log("Exception while writing resized image to bucket");
        });

      // generate a binary response with resized image
      response.status = 200;
      response.body = buffer.toString("base64");
      response.bodyEncoding = "base64";
      response.headers["content-type"] = [
        { key: "Content-Type", value: "image/" + type }
      ];
      callback(null, response);
    })
    // get the source image file

    .catch(err => {
      console.log(JSON.stringify(err));
      console.log("Exception while reading source image :%j", err);
    });
};
