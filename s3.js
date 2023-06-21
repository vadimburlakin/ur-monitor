const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand
} = require("@aws-sdk/client-s3");

const { streamToString } = require("./utils.js");

module.exports.upload = async function upload(bucket, key, data) {
  const s3 = new S3Client({ region: process.env.AWS_REGION });
  const uploadParams = {
    Bucket: bucket,
    Key: key,
    Body: data
  };
  const command = new PutObjectCommand(uploadParams);
  await s3.send(command);
};

module.exports.download = async function download(bucket, key) {
  const s3 = new S3Client({ region: process.env.AWS_REGION });
  const downloadParams = {
    Bucket: bucket,
    Key: key
  };
  const command = new GetObjectCommand(downloadParams);
  const response = await s3.send(command);
  return await streamToString(response.Body);
};
