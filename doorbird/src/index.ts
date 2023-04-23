import * as functions from "firebase-functions";
import axios from "axios";

const VoiceResponse = require("twilio").twiml.VoiceResponse;

const formData = require("form-data");
const Mailgun = require("mailgun.js");
const mailgun = new Mailgun(formData);

const secretKeys = [
  "DOORBIRD_BASIC_AUTH",
  "MAILGUN_API_KEY",
  "MAILGUN_DOMAIN",
  "TWILIO_API_SID",
  "TWILIO_API_SECRET",
] as const;
type Secrets = Record<(typeof secretKeys)[number], string>;

export const doorbird = functions
  .runWith({ secrets: [...secretKeys] })
  .https.onRequest(async (request, response) => {
    // @ts-ignore
    const secrets = process.env as Secrets;

    console.log(request.path);

    if (request.path === "/doorbird/twilio") {
      const { Caller, CallerCountry, CallerState } = request.body;
      console.log(Caller, CallerCountry, CallerState);

      // take a picture
      const imageResponse = await axios.get(
        "https://apiindy.doorbird.net/intercom/proxy/local/Doorcom/image.cgi",
        {
          headers: {
            Authorization: `Basic ${secrets.DOORBIRD_BASIC_AUTH}`,
          },
          responseType: "arraybuffer",
        }
      );

      if (!response.status(200)) {
        console.error("Failed to take photo");
        return;
      }
      const imageBuffer = Buffer.from(imageResponse.data, "binary");

      const openDoor = async () => {
        const open = async () => {
          // open the door
          const doorResponse = await axios.get(
            "https://apiindy.doorbird.net/intercom/proxy/local/Doorcom/door.cgi?r=1",
            {
              headers: {
                Authorization: `Basic ${secrets.DOORBIRD_BASIC_AUTH}`,
              },
              responseType: "json",
            }
          );

          console.log("Door opened");

          return doorResponse.data.BHA?.RETURNCODE === 1;
        };

        const wait = (ms = 3000) =>
          new Promise((resolve) => setTimeout(resolve, ms));

        // open a couple of times
        await open();
        await wait();
        await open();
        await wait();
        await open();
      };

      const recordEntrance = async () => {
        const mg = mailgun.client({
          username: "api",
          key: secrets.MAILGUN_API_KEY,
        });

        const formatter = new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: true,
          minute: "numeric",
          weekday: "short",
          timeZone: "America/Los_Angeles",
        });

        await mg.messages.create(secrets.MAILGUN_DOMAIN, {
          from: `Email Sender <mailgun@${secrets.MAILGUN_DOMAIN}>`,
          to: `roomies.svn@icloud.com`,
          subject: `Entrance on ${formatter.format(Date.now())}`,
          html: `Call from ${Caller} (${CallerState}, ${CallerCountry}) <br> <img alt="image" id="1" src="cid:image.jpg"/>`,
          inline: {
            filename: "image.jpg",
            data: imageBuffer,
          },
        });

        console.log("Entrance recorded");
      };

      const respondOnPhone = async () => {
        const twiml = new VoiceResponse();
        twiml.say({ voice: "matthew" }, `The door has opened`);

        response.type("text/xml");
        response.send(twiml.toString());

        console.log("Responded on phone");
      };

      await Promise.all([openDoor(), recordEntrance(), respondOnPhone()]);
    }

    response.status(404);
  });
