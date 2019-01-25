// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// Licensed under the Amazon Software License
// http://aws.amazon.com/asl/

function noMobileNumberRegistered(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    return responseBuilder
        .speak('Your mobile number is not registered with this device. Please contact the skill administrator.')
        .withShouldEndSession(true)
        .getResponse();
}

function elicitSlotResponse(slotName, handlerInput, speech, repromptSpeech) {
    const responseBuilder = handlerInput.responseBuilder;
    const currentIntent = handlerInput.requestEnvelope.request.intent;
   
    return responseBuilder
        .speak(speech)
        .reprompt(repromptSpeech)
        .addElicitSlotDirective(slotName, currentIntent)
        .getResponse();

}

function promptForPin(handlerInput) {
    return elicitSlotResponse(
        'PIN',
        handlerInput,
        `Please provide the Security code`,
        `Try providing the Security code`);
}

function promptWithValidPin(handlerInput, speechResponse, wasPINProvidedAndValidated) {
    const responseBuilder = handlerInput.responseBuilder;
    let speechText = speechResponse;
    if (wasPINProvidedAndValidated) {
        speechText = `<speak> <audio src='https://s3.amazonaws.com/ask-soundlibrary/ui/gameshow/amzn_ui_sfx_gameshow_positive_response_01.mp3'/>
                        Security Code Validated. <break time="1s"/> ${speechResponse} </speak>`;
    }
    return responseBuilder
        .speak(speechText)
        .reprompt(`Would you like to know anything else?`)            
        .getResponse();
    
}

function promptForInvalidPin(handlerInput) {
    return elicitSlotResponse(
        'PIN',
        handlerInput,
        `<speak><audio src='https://s3.amazonaws.com/ask-soundlibrary/ui/gameshow/amzn_ui_sfx_gameshow_negative_response_01.mp3'/> 
        Invalid code specified. Please provide the Security code.</speak>`,
        `Try providing the Security code`);
}

exports.promptForPin = promptForPin;
exports.promptForInvalidPin = promptForInvalidPin;
exports.noMobileNumberRegistered = noMobileNumberRegistered;
exports.promptWithValidPin = promptWithValidPin;