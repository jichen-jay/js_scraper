import fs from 'fs';
import { JSDOM } from 'jsdom';

function extractDiscussionContent() {
    const html = fs.readFileSync('assets/reddit.html', 'utf8');
    const dom = new JSDOM(html);
    const { window } = dom;
    const { document } = window;
}



async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            // Get the height of the viewport
            const viewportHeight = window.innerHeight;

            // Scroll down by the height of the viewport
            window.scrollBy(0, viewportHeight);

            // Give some time to load new content, if any
            setTimeout(resolve, 1000); // wait 1 second for content to load
        });
    });
}

