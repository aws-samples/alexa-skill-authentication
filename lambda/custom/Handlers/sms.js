// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// Licensed under the Amazon Software License
// http://aws.amazon.com/asl/

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');


// Set region
AWS.config.update({ region: process.env.AWSREGION });
const sns = new AWS.SNS();

async function sendSMS(phoneNumber, pin) {

    // Create SMS Attribute parameters
    const params1 = {
        attributes: { 
            'DefaultSMSType': 'Transactional' 
        }
    };

    // Create promise and SNS service object
    await sns.setSMSAttributes(params1).promise();

    // Create publish parameters
    const params = {
        Message: `Business Insights: Your security code is ${pin}`,
        PhoneNumber: phoneNumber,
    };

    // Create promise and SNS service object
    return sns.publish(params).promise();
}

exports.sendSMS = sendSMS;
