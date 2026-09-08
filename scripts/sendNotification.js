import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const messaging = getMessaging();

const title = process.env.NOTIFICATION_TITLE || "VOLUME";
const message =
  process.env.NOTIFICATION_MESSAGE ||
  "You have a new VOLUME notification.";

const targetUID = process.env.TARGET_UID || "";

async function sendNotification() {
  try {
    const usersSnapshot = await db.collection("users").get();

    const tokens = [];

    for (const userDoc of usersSnapshot.docs) {
      if (targetUID && userDoc.id !== targetUID) {
        continue;
      }

      const userData = userDoc.data();

      if (!targetUID && userData.role !== "employee") {
        continue;
      }

      const tokenSnapshot = await userDoc.ref
        .collection("pushTokens")
        .get();

      tokenSnapshot.forEach((tokenDoc) => {
        const tokenData = tokenDoc.data();

        if (tokenData.token) {
          tokens.push(tokenData.token);
        }
      });
    }

    if (tokens.length === 0) {
      console.log("No push tokens found.");
      return;
    }

    console.log(`Sending notification to ${tokens.length} device(s).`);

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body: message
      },
      data: {
        type: "timetable_published",
        url: "https://danyalrahujo.github.io/volume-pwa/"
      }
    });

    console.log(
      `Notification sent. Success: ${response.successCount}, Failed: ${response.failureCount}`
    );

    response.responses.forEach((result, index) => {
      if (!result.success) {
        console.error(
          `Failed token ${index}:`,
          result.error?.message || result.error
        );
      }
    });
  } catch (error) {
    console.error("Notification sender error:", error);
    process.exitCode = 1;
  }
}

sendNotification();