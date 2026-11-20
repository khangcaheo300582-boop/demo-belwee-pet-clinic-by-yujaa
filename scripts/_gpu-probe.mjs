import { chromium } from "playwright";
const modes = [
  { name: "headless-shell", opts: { headless: true, args: ["--autoplay-policy=no-user-gesture-required"] } },
  { name: "new-headless", opts: { headless: true, channel: "chromium", args: ["--autoplay-policy=no-user-gesture-required"] } },
  { name: "headed", opts: { headless: false, args: ["--autoplay-policy=no-user-gesture-required"] } },
];
for (const m of modes) {
  let b;
  try {
    b = await chromium.launch(m.opts);
    const cdp = await b.newBrowserCDPSession();
    const info = await cdp.send("SystemInfo.getInfo");
    const gpu = info.gpu || {};
    console.log(m.name, "OK", JSON.stringify({ devices: (gpu.devices||[]).map(d=>d.vendorString+" / "+d.deviceString), aux: gpu.auxAttributes && { glRenderer: gpu.auxAttributes.glRenderer, glVendor: gpu.auxAttributes.glVendor }, featureStatus: gpu.featureStatus }, null, 1).slice(0, 1400));
  } catch (e) {
    console.log(m.name, "FAIL", String(e).slice(0, 400));
  } finally {
    if (b) await b.close().catch(()=>{});
  }
}
process.exit(0);
