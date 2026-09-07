/* eslint-disable @typescript-eslint/no-require-imports */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const prototypePath = path.join(__dirname, "group-case-grading.html");

async function verify() {
  const server = http.createServer((request, response) => {
    if (request.url !== "/group-case-grading.html") {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    fs.createReadStream(prototypePath).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Prototype server did not start");
  const browser = await chromium.launch({ headless: true });
  const url = `http://127.0.0.1:${address.port}/group-case-grading.html`;

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    page.setDefaultTimeout(5_000);
    await page.goto(url);
    await page.getByRole("button", { name: /Jordan Lee/ }).first().click();
    await page.getByRole("button", { name: "Green flag" }).click();
    await page.getByLabel("What happened?").fill("=HYPERLINK(\"https://invalid.example\") invited a quieter teammate to speak.");
    await page.getByRole("button", { name: "Save observation" }).click();
    await page.getByText(/invited a quieter teammate/).waitFor();
    if (!await page.getByRole("button", { name: /Maya Patel.*0 notes/ }).first().isVisible()) {
      throw new Error("An observation must stay with the selected applicant");
    }

    await page.getByRole("button", { name: "Finish scores" }).click();
    const rubric = page.locator("#rubric");
    for (const name of [
      "Team Collaboration",
      "Structured Problem-Solving",
      "Leadership and Initiative",
      "Creativity and Business Judgment",
      "Composure and Time Management",
      "Presentation and Communication",
    ]) {
      await rubric.getByRole("radiogroup", { name }).getByRole("button", { name: "4", exact: true }).click();
    }
    if (!await page.getByRole("button", { name: "Review this evaluation" }).isEnabled()) {
      throw new Error("All six ratings must make the applicant ready for review");
    }

    await page.evaluate("applicants[0].name = '=Injected Name'");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download Excel-ready backup" }).click();
    const download = await downloadPromise;
    if (download.suggestedFilename() !== "group-case-2-judge-backup.csv") throw new Error("Unexpected backup filename");
    const downloadPath = await download.path();
    const csv = fs.readFileSync(downloadPath, "utf8");
    if (!csv.startsWith("\ufefffile_id,")) throw new Error("Excel backup must use a UTF-8 byte-order mark");
    if (!csv.includes("'=Injected Name")) throw new Error("Excel backup must neutralize formula-like text cells");

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(url);
    await mobile.getByRole("button", { name: /Priya Shah/ }).first().click();
    await mobile.getByLabel("What happened?").fill("Connected the client constraint to the recommendation.");
    if (!await mobile.getByRole("button", { name: "Save observation" }).isVisible()) throw new Error("Mobile composer is not usable");
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

verify()
  .then(() => console.log("Group Case grading prototype passed on desktop and mobile."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
