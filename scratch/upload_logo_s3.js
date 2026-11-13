const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../Backend/.env') });
const fs = require('fs');
const AWS = require('aws-sdk');

const bucketName = process.env.AWS_S3_BUCKET || 'ufsnabeelphotoalbum';
const region = process.env.AWS_REGION || 'us-east-2';

console.log('Using bucket:', bucketName, 'region:', region);
console.log('Access Key ID:', process.env.AWS_ACCESS_KEY_ID);

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: region
});

const s3 = new AWS.S3();
const logoPath = path.join(__dirname, '../Backend/helpers/aiveslogo_small.png');
const fileContent = fs.readFileSync(logoPath);

const params = {
    Bucket: bucketName,
    Key: 'aiveslogo.png',
    Body: fileContent,
    ContentType: 'image/png',
    ACL: 'public-read'
};

s3.upload(params, function(err, data) {
    if (err) {
        console.error('Error uploading to S3 with ACL public-read:', err.message);
        // Retry without ACL if bucket does not allow ACLs
        delete params.ACL;
        s3.upload(params, function(err2, data2) {
            if (err2) {
                console.error('Error uploading to S3 without ACL:', err2.message);
            } else {
                console.log('Successfully uploaded logo to S3 without ACL:', data2.Location);
            }
        });
    } else {
        console.log('Successfully uploaded logo to S3 with public-read:', data.Location);
    }
});

