// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// Licensed under the Amazon Software License
// http://aws.amazon.com/asl/
const Alexa = require("ask-sdk");
const authMgr = require('./Handlers/auth.js');
const speechHandler = require('./Handlers/speechHandler.js');

const LaunchRequest_Handler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === "LaunchRequest";
  },
  async handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    return responseBuilder
      .speak("Welcome to Business Insights. How can I help you?")
      .reprompt("Try asking me about your company's sales growth")
      .getResponse();
  }
};

const SalesTrend_Handler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.intent.name === "SalesTrend";
  },
  async handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const responseBuilder = handlerInput.responseBuilder;
    const currentIntent = request.intent;

    const slotValues = getSlotValues(currentIntent.slots);
    console.log(JSON.stringify(slotValues));
    let speechResponse;

    ///// SECURITY CODE
    let wasPINProvidedAndValidated = false;
    const deviceId =
      handlerInput.requestEnvelope.context.System.device.deviceId;
    console.log(`deviceId = ${JSON.stringify(deviceId)}`);

    // If PIN Slot is not filled
    if (!slotValues.PIN.heardAs) {
      console.log("To be authenticated.");
      const result = await authMgr.authenticate(deviceId);

      if (result.action === "EndSession") {
        console.log("No Mapping Mobile Number found for the device");
        return speechHandler.noMobileNumberRegistered(handlerInput);
      }

      if (result.action !== "Continue") {
        console.log("Not authenticated. PIN Reqd");
        return speechHandler.promptForPin(handlerInput);
      }
    } else {
      const pinValid = await authMgr.isPinValid(deviceId, slotValues.PIN.heardAs);
      
      if (!pinValid) {
        console.log("PIN is Invalid");
        return speechHandler.promptForInvalidPin(handlerInput);
      }    
      wasPINProvidedAndValidated = true;
    }
    ///// SECURITY CODE END ///////////////////    
    
    // User wants Year to date Sales Growth
    if (!slotValues.When.heardAs && !slotValues.Period.heardAs) {
      speechResponse =
        "Good news!! Sales growth has been strong so far. There has been a 10% increase compared to last year";
      return  speechHandler.promptWithValidPin(handlerInput, speechResponse, wasPINProvidedAndValidated) 
    }

    // User wants to know Sales growth Last Year or Month
    if (slotValues.When.resolved && slotValues.Period.resolved) {
      speechResponse = `Sales growth ${slotValues.When.resolved} ${slotValues.Period.resolved} compared to current ${slotValues.Period.resolved} was lower by 7%.`;
      return  speechHandler.promptWithValidPin(handlerInput, speechResponse, wasPINProvidedAndValidated) 
    }
  }
};

const FinancialTrend_Handler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.intent.name === "FinancialTrend";
  },
  async handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const responseBuilder = handlerInput.responseBuilder;
    const currentIntent = request.intent;

    const slotValues = getSlotValues(currentIntent.slots);
    console.log(JSON.stringify(slotValues));
    let speechResponse;

    ///// SECURITY CODE
    const deviceId =
      handlerInput.requestEnvelope.context.System.device.deviceId;
    console.log(`deviceId = ${JSON.stringify(deviceId)}`);

    let wasPINProvidedAndValidated = false;
    if (!slotValues.PIN.heardAs) {
      console.log("To be authenticated.");
      const result = await authMgr.authenticate(deviceId);

      if (result.action === "EndSession") {
        console.log("No Mapping Mobile Number found for the device");
        return speechHandler.noMobileNumberRegistered(handlerInput);
      }

      if (result.action !== "Continue") {
        console.log("Not authenticated. PIN Reqd");
        return speechHandler.promptForPin(handlerInput);
      }
    } else {
      const pinValid = await authMgr.isPinValid(
        deviceId,
        slotValues.PIN.heardAs
      );
      if (!pinValid) {
        console.log("PIN is Invalid");
        return speechHandler.promptForInvalidPin(handlerInput);
      }      
      wasPINProvidedAndValidated = true;
    }
    ///// SECURITY CODE END
    
    // User wants to know Net Profit Margin till date for current year
    if (!slotValues.When.heardAs && !slotValues.Period.heardAs) {
      speechResponse = "Its looking good ! Net profit margin is at 60%.";
      return speechHandler.promptWithValidPin(handlerInput, speechResponse, wasPINProvidedAndValidated) 
    }
    // User wants to know Net Profit Margin Lst year or Month
    if (slotValues.When.resolved && slotValues.Period.resolved) {
      speechResponse = `Net profit margin ${slotValues.When.resolved} ${
        slotValues.Period.resolved
      } compared to current ${slotValues.Period.resolved} was lower by 15%.`;
      return  speechHandler.promptWithValidPin(handlerInput, speechResponse, wasPINProvidedAndValidated) 
    }  

  }
};

const SignOutIntent_Handler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (
      request.type === "IntentRequest" && request.intent.name === "SignOut"
    );
  },
  async handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    console.log(`Original Request was: ${JSON.stringify(handlerInput.requestEnvelope.request, null, 2)}`);

    const deviceId = handlerInput.requestEnvelope.context.System.device.deviceId;
    await authMgr.deleteAuthInfo(deviceId);
    
    return responseBuilder
      .speak(`Okay, I have signed you out. Talk to you later!`)
      .withShouldEndSession(true)
      .getResponse();
  }
};

const AMAZON_FallbackIntent_Handler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (
      request.type === "IntentRequest" &&
      request.intent.name === "AMAZON.FallbackIntent"
    );
  },
  handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    console.log(
      `Original Request was: ${JSON.stringify(
        handlerInput.requestEnvelope.request,
        null,
        2
      )}`
    );

    return responseBuilder
      .speak("Please check with your admin for this information.")
      .getResponse();
  }
};

const AMAZON_CancelIntent_Handler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (
      request.type === "IntentRequest" &&
      request.intent.name === "AMAZON.CancelIntent"
    );
  },
  handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    let say = "Okay, talk to you later! ";

    return responseBuilder
      .speak(say)
      .withShouldEndSession(true)
      .getResponse();
  }
};

const AMAZON_HelpIntent_Handler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (
      request.type === "IntentRequest" &&
      request.intent.name === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;

    return responseBuilder
      .speak("Try asking me about your company's sales growth")
      .reprompt("Try asking me about your company's sales growth")
      .getResponse();
  }
};

const AMAZON_StopIntent_Handler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (
      request.type === "IntentRequest" &&
      request.intent.name === "AMAZON.StopIntent"
    );
  },
  handle(handlerInput) {
    const responseBuilder = handlerInput.responseBuilder;
    let say = "Okay, talk to you later! ";

    return responseBuilder
      .speak(say)
      .withShouldEndSession(true)
      .getResponse();
  }
};

const SessionEndedHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === "SessionEndedRequest";
  },
  handle(handlerInput) {
    console.log(
      `Session ended with reason: ${
        handlerInput.requestEnvelope.request.reason
      }`
    );
    return handlerInput.responseBuilder.getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    const request = handlerInput.requestEnvelope.request;
    console.log(`Error handled: ${error}`);
    console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);

    return handlerInput.responseBuilder
      .speak("Please check with your admin for this information.")
      .getResponse();
  }
};

function getSlotValues(filledSlots) {
  const slotValues = {};

  Object.keys(filledSlots).forEach(item => {
    const name = filledSlots[item].name;

    if (
      filledSlots[item] &&
      filledSlots[item].resolutions &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0] &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0].status &&
      filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code
    ) {
      switch (
        filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code
      ) {
        case "ER_SUCCESS_MATCH":
          slotValues[name] = {
            heardAs: filledSlots[item].value,
            resolved:
              filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0]
                .value.name,
            ERstatus: "ER_SUCCESS_MATCH"
          };
          break;
        case "ER_SUCCESS_NO_MATCH":
          slotValues[name] = {
            heardAs: filledSlots[item].value,
            resolved: "",
            ERstatus: "ER_SUCCESS_NO_MATCH"
          };
          break;
        default:
          break;
      }
    } else {
      slotValues[name] = {
        heardAs: filledSlots[item] != null ? filledSlots[item].value : "", // may be null
        resolved: "",
        ERstatus: ""
      };
    }
  }, this);

  return slotValues;
}

const YesIntent = {
  canHandle(handlerInput) {
      const request = handlerInput.requestEnvelope.request;
      return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.YesIntent';
  },
  handle(handlerInput) {
      const responseBuilder = handlerInput.responseBuilder;
      console.log(`Original Request was: ${JSON.stringify(handlerInput.requestEnvelope.request, null, 2)}`);

      return responseBuilder
          .speak(`Okay, Try asking me about your company's sales growth.`)
          .reprompt('You can ask me how Sales is doing or about net profit margin. What do you prefer?')
          .getResponse();
  },
};

const NoIntent = {
  canHandle(handlerInput) {
      const request = handlerInput.requestEnvelope.request;
      return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.NoIntent';
  },
  async handle(handlerInput) {
      const responseBuilder = handlerInput.responseBuilder;
      console.log(`Original Request was: ${JSON.stringify(handlerInput.requestEnvelope.request, null, 2)}`);

      return responseBuilder
          .speak('Okay, talk to you later!')
          .getResponse();
  },
};

// 4. Exports handler function and setup ===================================================
const skillBuilder = Alexa.SkillBuilders.standard();
exports.handler = skillBuilder
  .addRequestHandlers(
    AMAZON_FallbackIntent_Handler,
    AMAZON_CancelIntent_Handler,
    AMAZON_HelpIntent_Handler,
    AMAZON_StopIntent_Handler,
    LaunchRequest_Handler,
    SessionEndedHandler,
    SignOutIntent_Handler,
    SalesTrend_Handler,
    FinancialTrend_Handler,
    YesIntent,
    NoIntent
  )
  .addErrorHandlers(ErrorHandler)  
  .lambda();
