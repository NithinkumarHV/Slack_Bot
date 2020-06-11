var PORT = process.env.PORT || 5000;
const express = require("express");
const request = require("request");
const bodyParser = require("body-parser");
const qrcode = require("qrcode");
const fs = require("fs");
const app = express();
const cors = require("cors");
const ejs = require("ejs");
const { App } = require("@slack/bolt");
const config = require("./config/config.js")

const urlencodedParser = bodyParser.urlencoded({ extended: true });

const token = config.token

const botkeys = new App({
  token: token,
  signingSecret: config.signingSecret,
});

app.set("view engine", "ejs");
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.use(cors());

app.listen(PORT, async function () {
  console.log("Chat server running");
  await getUserDetails();
  console.log(usersList);
});

var Approve = false;
var selectedUserId;
var selectedUserName;
var sentMessage;
var meetingDetails = {};
var usersList = {};
var assignedFrom;

//Function for getting the channelId of the user.
async function dmChannelId(selectedUserId) {
  const channelResponse = await botkeys.client.conversations.open({
    token: token,
    users: selectedUserId,
  });
  console.log("***********channel id***********", channelResponse.channel.id);
  return channelResponse.channel.id;
}

async function sendMessage() {
  //Get the channel Id of the host to whom the message need to be sent
  const userChannelId = await dmChannelId(
    usersList[meetingDetails.host_name][0]
  );
  // Call the chat.postMessage method using the built-in WebClient
  const result = await botkeys.client.chat.postMessage({
    // The token you used to initialize your app is stored in the `context` object
    token: token,
    // Payload message should be posted in the channel where original message was heard
    channel: userChannelId,
    blocks: [
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*Hi, you have " +
            meetingDetails.visitor_name +
            " waiting at lobby*",
        },
      },
      {
        type: "divider",
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*From:* " + meetingDetails.from,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Time:* " + meetingDetails.Meeting_time,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Purpose:* " + meetingDetails.POM,
          },
        ],
      },
      {
        type: "divider",
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              emoji: true,
              text: "Approve",
            },
            style: "primary",
            value: "click_me_123",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              emoji: true,
              text: "Reassign",
            },
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              emoji: true,
              text: "Reschedule",
            },
            style: "danger",
            value: "click_me_123",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              emoji: true,
              text: "Cancel",
            },
            style: "danger",
            value: "click_me_123",
          },
        ],
      },
    ],
  });
}

//Get the userDetails which is in the form [Name]:[userId,channelId]
async function getUserDetails() {
  const users_list = await botkeys.client.users.list({
    token: token,
  });
  const usersDetails = users_list.members;
  // console.log(usersDetails);
  for (var i = 0; i < usersDetails.length; i++) {
    if (
      !usersDetails[i].real_name.includes("bot") &&
      usersDetails[i].is_bot !== true
    )
      usersList[usersDetails[i].real_name] = [usersDetails[i].id];
  }
  // console.log(usersList);
  if (users_list) {
    for (var i = 0; i < usersDetails.length; i++) {
      console.log(usersDetails[i].id);
      if (
        !usersDetails[i].real_name.includes("bot") &&
        usersDetails[i].is_bot !== true
      ) {
        const channelResponse = await botkeys.client.conversations.open({
          token: token,
          users: usersDetails[i].id,
        });
        console.log(channelResponse.channel.id);
        usersList[`${usersDetails[i].real_name}`][1] =
          channelResponse.channel.id;
      }
    }
  }
}

//Function for sending notification after reassign
async function notifyReassigned(meetingDetails, selectedUserId) {
  const selectedUserChannelId = await dmChannelId(selectedUserId);
  const result = await botkeys.client.chat.postMessage({
    // The token you used to initialize your app is stored in the `context` object
    token: token,
    // Payload message should be posted in the channel where original message was heard
    channel: selectedUserChannelId,
    blocks: [
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*Hi,  " +
            assignedFrom +
            "  has reassigned a scheduled meet to you*",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Visitor:* " + meetingDetails.visitor_name,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*From:* " + meetingDetails.from,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Time:* " + meetingDetails.Meeting_time,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Purpose:* " + meetingDetails.POM,
          },
        ],
      },
      {
        type: "divider",
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              emoji: true,
              text: "Accept",
            },
            style: "primary",
            value: "click_me_123",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              emoji: true,
              text: "Deny",
            },
            style: "danger",
            value: "click_me_123",
          },
        ],
      },
    ],
  });
}

//Function for resheduling
async function reschedule(trigger_id) {
  console.log(
    "**********************************************************",
    trigger_id
  );
  const response = await botkeys.client.views.open({
    token: token,
    trigger_id: trigger_id,
    view: {
      type: "modal",
      title: {
        type: "plain_text",
        text: "Reschedule your meeting",
        emoji: true,
      },
      submit: {
        type: "plain_text",
        text: "Submit",
        emoji: true,
      },
      close: {
        type: "plain_text",
        text: "Cancel",
        emoji: true,
      },
      blocks: [
        {
          type: "input",
          element: {
            type: "datepicker",
            initial_date: "1990-04-28",
            placeholder: {
              type: "plain_text",
              text: "Select a date",
              emoji: true,
            },
          },
          label: {
            type: "plain_text",
            text: "New Date",
            emoji: true,
          },
        },
        {
          type: "input",
          element: {
            type: "plain_text_input",
          },
          label: {
            type: "plain_text",
            text: "Input new time in HH:MM format",
            emoji: true,
          },
        },
      ],
    },
  });
}

//sending message once the request is accepted by the reassignee
async function acceptToHost(selectedUserName) {
  const userChannelId = await dmChannelId(
    usersList[meetingDetails.host_name][0]
  );
  const result = await botkeys.client.chat.postMessage({
    token: token,
    channel: userChannelId,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*Your request has been accepted by " +
            selectedUserName +
            " for following metting*",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Visitor:* " + meetingDetails.visitor_name,
          },
          {
            type: "mrkdwn",
            text: "*From:* " + meetingDetails.from,
          },
          {
            type: "mrkdwn",
            text: "*Time:* " + meetingDetails.Meeting_time,
          },
          {
            type: "mrkdwn",
            text: "*Purpose:* " + meetingDetails.POM,
          },
        ],
      },
      {
        type: "divider",
      },
    ],
    replace_original: true,
  });
}

//sending message once the request is denied by the reassignee
async function denyToHost(selectedUserName) {
  const userChannelId = await dmChannelId(
    usersList[meetingDetails.host_name][0]
  );
  const result = await botkeys.client.chat.postMessage({
    // The token you used to initialize your app is stored in the `context` object
    token: token,
    // Payload message should be posted in the channel where original message was heard
    channel: userChannelId,
    blocks: [
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            selectedUserName +
            " *has denied your request to attend " +
            meetingDetails.visitor_name +
            " , Please Choose an action*",
        },
      },
      {
        type: "divider",
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*From:* " + meetingDetails.from,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Time:* " + meetingDetails.Meeting_time,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Purpose:* " + meetingDetails.POM,
          },
        ],
      },
      {
        type: "divider",
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              emoji: true,
              text: "Approve",
            },
            style: "primary",
            value: "click_me_123",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              emoji: true,
              text: "Reassign",
            },
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              emoji: true,
              text: "Reschedule",
            },
            style: "danger",
            value: "click_me_123",
          },
        ],
      },
    ],
    replace_original: true,
  });
}

//for sending meeting details
app.post("/bot", urlencodedParser, async (req, res) => {
  const payload = req.body;
  console.log(
    "******************************request***********************",
    req.body
  );

  meetingDetails.host_name = payload.Vhost;
  meetingDetails.visitor_name = payload.VName;
  meetingDetails.Meeting_time = payload.Vtime;
  meetingDetails.POM = payload.Vpurpose;
  meetingDetails.from = payload.Vcompany;

  await getUserDetails(); // Get all the user deatils

  assignedFrom = meetingDetails.host_name; //Get the host name

  sendMessage(); //call send message function that sends message to the host

  res.json({
    msg: usersList,
  });
});

app.get("/get_all_user_details", async (req, res) => {
  await getUserDetails();
  res.send({ users: usersList });
});

approve = () => {
  sentMessage = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*Your meeting with " +
            meetingDetails.visitor_name +
            " is confirmed*",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Time:* " + meetingDetails.Meeting_time,
          },
          {
            type: "mrkdwn",
            text: "*Purpose:* " + meetingDetails.POM,
          },
        ],
      },
      {
        type: "divider",
      },
    ],
    replace_original: true,
  };
  return sentMessage;
};

reassign = () => {
  sentMessage = {
    blocks: [
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "Please Reassign your meeting with " + meetingDetails.visitor_name,
        },
        accessory: {
          action_id: "text1234",
          type: "users_select",
          placeholder: {
            type: "plain_text",
            text: "Pick an user to reassign",
          },
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Time: " + meetingDetails.Meeting_time,
          },
          {
            type: "mrkdwn",
            text: "Purpose: " + meetingDetails.POM,
          },
        ],
      },
      {
        type: "divider",
      },
    ],
    replace_original: true,
  };
  return sentMessage;
};

accept = () => {
  sentMessage = {
    blocks: [
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*You accepted reassign request from, " +
            assignedFrom +
            " we have notified the same to user*",
        },
      },
      {
        type: "divider",
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Meeting details for reference*",
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Visitor:* " + meetingDetails.visitor_name,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*From:* " + meetingDetails.from,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Time:* " + meetingDetails.Meeting_time,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Purpose:* " + meetingDetails.POM,
          },
        ],
      },
      {
        type: "divider",
      },
    ],
    replace_original: true,
  };
  return sentMessage;
};

deny = () => {
  sentMessage = {
    blocks: [
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*You denied reassign request from, " +
            assignedFrom +
            " we have notified the same to user*",
        },
      },
      {
        type: "divider",
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Meeting details for reference*",
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Visitor:* " + meetingDetails.visitor_name,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*From:* " + meetingDetails.from,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Time:* " + meetingDetails.Meeting_time,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "*Purpose:* " + meetingDetails.POM,
          },
        ],
      },
      {
        type: "divider",
      },
    ],
    replace_original: true,
  };
  return sentMessage;
};

getUserNameById = (Id) => {
  for (x in usersList) {
    if (usersList[x][0] === Id) {
      return x;
    }
  }
};

function sendMessageToSlackResponseURL(responseURL, JSONmessage) {
  var postOptions = {
    uri: responseURL,
    method: "POST",
    headers: {
      "Content-type": "application/json",
    },
    json: JSONmessage,
  };
  request(postOptions, (error, response, body) => {
    if (error) {
      console.log("error", error);
    }
    console.log("response", response, body);
  });
}

app.post("/check", urlencodedParser, (req, res) => {
  console.log("meetingDetails", meetingDetails);
  res.status(200).end(); // best practice to respond with 200 status
  var actionJSONPayload = req.body.payload;
  actionJSONPayload = JSON.parse(actionJSONPayload);

  if (actionJSONPayload.type === "view_submission") {
    // var actionPayload = JSON.stringify(actionJSONPayload);
    // console.log(actionPayload);
    // actionPayload = JSON.parse(actionPayload);
    const block_id_date = actionJSONPayload.view.blocks[0].block_id;
    const action_id_date = actionJSONPayload.view.blocks[0].element.action_id;
    const block_id_time = actionJSONPayload.view.blocks[1].block_id;
    const action_id_time = actionJSONPayload.view.blocks[1].element.action_id;
    console.log("block_id", block_id_date, action_id_date);
    console.log(
      "Date",
      actionJSONPayload.view.state.values[block_id_date][action_id_date]
        .selected_date
    );
    console.log(
      "Time",
      actionJSONPayload.view.state.values[block_id_time][action_id_time].value
    );
  } else if (actionJSONPayload.actions[0].type === "users_select") {
    selectedUserId = actionJSONPayload.actions[0].selected_user;
    console.log("selected user", selectedUserId);

    selectedUserName = getUserNameById(selectedUserId);

    notifyReassigned(meetingDetails, selectedUserId);

    message = {
      text:
        "waiting for " +
        selectedUserName +
        " to Accept: You will be notified of their response",
      replace_original: true,
    };
  } else if (actionJSONPayload.actions[0].type === "button") {
    var actionText = actionJSONPayload.actions[0].text.text;
    console.log("actions", actionText);

    if (actionText === "Approve") {
      console.log("Hello");
      Approve = true;
      message = approve();
    } else if (actionText === "Reassign") {
      message = reassign();
    } else if (actionText === "Deny") {
      message = deny();
      denyToHost(selectedUserName);
    } else if (actionText === "Accept") {
      message = accept();
      acceptToHost(selectedUserName);
    } else if (actionText === "Cancel") {
      message = {
        text: "You have cancelled the meeting",
        replace_original: true,
      };
    } else if (actionText === "Reschedule") {
      var trigger_id = actionJSONPayload.trigger_id;
      console.log(
        "*******************************************************",
        trigger_id
      );
      reschedule(trigger_id);
      message = {
        text: actionJSONPayload.user.name + " clicked: Rescheduled ",
        replace_original: true,
      };
    } else {
      message = {
        text: actionJSONPayload.user.name + " clicked: Rescheduled ",
        replace_original: true,
      };
    }
  }
  console.log("message", message);
  console.log("URL", actionJSONPayload.response_url);
  sendMessageToSlackResponseURL(actionJSONPayload.response_url, message);
});

app.get("/register/:user_id", (req, res) => {
  var userId = req.params.user_id;
  var host_name = getUserNameById(userId);
  console.log(host_name);
  res.render("register", {
    host_name,
  });
});

app.post("/register/success", urlencodedParser, (req, res) => {
  console.log(req.body);
  var data = req.body;
  data = JSON.stringify(data);
  qrcode.toDataURL(data).then((image) => {
    console.log(image);
    res.render("qrcode", {
      image,
    });
  });
});

app.get("/reschedule", (req, res) => {
  res.render("reschedule");
});

app.get("/", (req, res) => {
  res.render("main");
});

app.post("/register_link", urlencodedParser, (req, res) => {
  const payload = req.body;
  console.log(
    "*****************************************************************payload************************************",
    payload
  );
  const user_id = payload.user_id;
  res.send(
    "Here is your Visitor Registration link " +
      " https://pknkbot.herokuapp.com/register/" +
      `${user_id}`
  );
});
