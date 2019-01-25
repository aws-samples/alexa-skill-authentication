// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// Licensed under the Amazon Software License
// http://aws.amazon.com/asl/
const AWS = require('aws-sdk');
const moment = require('moment');
const sms = require('./sms.js');

// Set the region 
AWS.config.update({ region: process.env.AWSREGION });
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'UserAuth'
const SMS_TABLE_NAME = 'DeviceContactMapping'

const PIN_VALIDTY_IN_MINS = process.env.PIN_TIMEOUT_IN_MINS;

function putAuthInfo(deviceId, pin) {
	const creationTime = moment.utc(new Date()).valueOf()
	const expirationTime = moment.utc(moment(new Date()).add(PIN_VALIDTY_IN_MINS, 'm').toDate()).valueOf();

	var params = {
		TableName: TABLE_NAME,
		Item: {
			id: deviceId,
			generatedPIN: pin,
			CreationTime: creationTime,
			ExpirationTime: expirationTime,
			PINValidated: 'No'
		}
	};
	// return dynamo result directly
	return dynamoDb.put(params).promise();
}

function updateAuthInfo(deviceId, generatedPIN, pinValidated, creationTime, expirationTime) {

	var params = {
		TableName: TABLE_NAME,
		Item: {
			id: deviceId,
			generatedPIN: generatedPIN,
			CreationTime: creationTime,
			ExpirationTime: expirationTime,
			PINValidated: pinValidated
		}
	};
	// return dynamo result directly
	return dynamoDb.put(params).promise();
}


async function getAuthInfo(deviceId) {
	const params = {};
	params.TableName = TABLE_NAME;
	const key = { id: deviceId };
	params.Key = key;

	// Return the Item from DDB
	return dynamoDb.get(params).promise();
}

async function deleteAuthInfo(deviceId) {
	const params = {};
	params.TableName = TABLE_NAME;
	const key = { id: deviceId };
	params.Key = key;

	// Return the Item from DDB
	return dynamoDb.delete(params).promise();
}

function generatePin() {
	return (Math.floor(Math.random() * 10000) + 10000).toString().substring(1);
}

function getPhoneNumber(deviceId) {

	params = {
		TableName: SMS_TABLE_NAME,
		Key: {
			id: deviceId
		}
	};

	// post-process dynamo result before returning
	return dynamoDb.get(params).promise();
}

async function isPinValid(deviceId, pin) {
	// 1. If no record exists in DDB for this DeviceId - Generate a new Token and store in DDB with PINValidated set to 'NO'. Send SMS to User.
	// User may enter the PIN immediately or after some time.
	const authResponse = await getAuthInfo(deviceId);
	const authInfo = authResponse.Item;
	if (authInfo) {
		// If PIN matches, make sure to update DDB 
		console.log(`Gen pin ${authInfo.generatedPIN}, entered pin ${pin}`);
		pin = pin.length === 3 ? '0'+pin: pin;
		
		if (authInfo.generatedPIN === pin) {
			console.log(`PIN Matches .. Updating DDB`);
			await updateAuthInfo(deviceId, authInfo.generatedPIN, 'Yes', authInfo.CreationTime, authInfo.ExpirationTime);
			console.log(`PIN Matches .. Updated DDB`);
			return new Promise((resolve, reject) => {
				resolve(true);
			});
		}
	}
	return new Promise((resolve, reject) => {
		resolve(false);
	});


}

async function authenticate(deviceId) {
	// 1. If no record exists in DDB for this DeviceId - Generate a new Token and store in DDB with PINValidated set to 'NO'. Send SMS to User.
	// Prompt user for a PIN. User may enter the PIN immediately or after some time.
	console.log('calling getAuthInfo');
	const authResponse = await getAuthInfo(deviceId);
	const authInfo = authResponse.Item;
	console.log(`authInfo = ${authInfo}`);

	if (!authInfo) {
		// Get Phone Number based on DeviceId
		const res = await getPhoneNumber(deviceId);
		console.log(JSON.stringify(res.Item));
		if (!res.Item) {
			return new Promise((resolve, reject) => {
				resolve({ action: 'EndSession' });
			});
		}
		console.log(`Creating new entry as no Auth record found for device ${deviceId}`);

		// Generate PIN
		const pin = generatePin();

		// Save in DDB
		await putAuthInfo(deviceId, pin);
		console.log('New Entry created');
		
		const phoneNumber = res.Item.PhoneNumber;		
		console.log(`Obtained phone number from Mapping Table ${phoneNumber}`);

		//Send SMS
		await sms.sendSMS(phoneNumber, pin);
		console.log(`Sent SMS to ${phoneNumber}`);

		// Prompt the User to enter the PIN if the PIN hasn't been validated yet
		return new Promise((resolve, reject) => {
			resolve({ action: 'PromptForPin' });
		});
	}
	else {
		console.log(`Auth record was found.Checking if its valid`);
		/*
		2. DDB get based on DeviceId/UserId. If record exists and PINValidated is 'No', check if previous Token has expired.
		If yes,Generate a new Token and store in DDB with PINValidated set to 'NO'. Send SMS to user.
		If no, prompt the user for the PIN. If wrong PIN entered, re-prompt. If valid PIN entered, update DDB PINValidated and speechText
		Session attribute PINValidated = 'Yes'. Continue.
		*/
		const currentDatetime = moment.utc(new Date()).valueOf();
		const currentTime = moment(currentDatetime);
		const expTime = moment(authInfo.ExpirationTime);

		differenceInMs = expTime.diff(currentTime); // diff yields milliseconds
		duration = moment.duration(differenceInMs); // moment.duration accepts ms
		differenceInMinutes = duration.asMinutes(); // Diference in Current and Expiration time in Minutes

		console.log(`PIN expires in ${differenceInMinutes} minutes`);

		// Check if the PINValidated is 'No'. User either never tried the PIN or provided wrong PIN
		if (authInfo.PINValidated === 'No') {			
			console.log(`PIN has not been validated yet`);
			// Get Phone Number based on DeviceId
			const res = await getPhoneNumber(deviceId);			
			console.log(JSON.stringify(res.Item));
			if (!res.Item) {
				return new Promise((resolve, reject) => {
					resolve({ action: 'EndSession' });
				});
			}
			const phoneNumber = res.Item.PhoneNumber;
			console.log(`Obtained phone number from Mapping Table ${phoneNumber}`);

			// if the Previous PIN has expired, generate a new one and send SMS
			if (differenceInMinutes < 0) {
				console.log(`PIN has expired. Generating a new one and updating DDB`);
				// Generate PIN
				const pin = generatePin();

				// Save in DDB
				await putAuthInfo(deviceId, pin);
				console.log('New Entry created');				

				//Send SMS
				await sms.sendSMS(phoneNumber, pin);
				console.log(`Sent SMS to ${phoneNumber}`);
				console.log(`PIN had expired. Generated a new one and updated DDB, sent SMS`);
			}
			console.log(`Returning a PromptForPIN action`);
			// Prompt the User to enter the PIN if the PIN hasn't been validated yet
			return new Promise((resolve, reject) => {
				resolve({ action: 'PromptForPin' });
			});

		}
		else {
			/*
			3. DDB get based on DeviceId/UserId. If record exists and PINValidated is 'Yes', check if previous Token has expired.
			If yes,Generate a new Token and store in DDB with PINValidated set to 'NO'. Send SMS to user.
			If no, Session attribute PINValidated = 'Yes'.
			*/

			console.log(`PIN has ben Validated.`);

			// If Previous PIN was validated but has expired, generate a new one and send SMS
			if (differenceInMinutes < 0) {
				console.log(`PIN has expired. Generating a new one`);
				// Get Phone Number based on DeviceId
				const res = await getPhoneNumber(deviceId);
				console.log(JSON.stringify(res.Item));
				if (!res.Item) {
					return new Promise((resolve, reject) => {
						resolve({ action: 'EndSession' });
					});
				}
				const phoneNumber = res.Item.PhoneNumber;

				// Generate PIN
				const pin = generatePin();

				// Save in DDB
				await putAuthInfo(deviceId, pin);				

				//Send SMS
				await sms.sendSMS(phoneNumber, pin);
				console.log(`Obtained phone number from Mapping Table`);
				console.log(`Returning a PromptForPin action`);
				// Prompt the User to enter the PIN
				return new Promise((resolve, reject) => {
					resolve({ action: 'PromptForPin' });
				});

			} else {
				console.log(`PIN has been validated and has not expired. Returning a Continue action`);
				// If Previous PIN was validated but has expired, nothing to do !!
				return new Promise((resolve, reject) => {
					resolve({ action: 'Continue' });
				});
			}

		}
	}
}

exports.authenticate = authenticate;
exports.isPinValid = isPinValid;
exports.deleteAuthInfo = deleteAuthInfo;