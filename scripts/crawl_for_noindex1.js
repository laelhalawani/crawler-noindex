const {chromium} = require('@playwright/test');
const { Console } = require('console');
const fs = require('fs');



//extensions to check for in the url and ignore if present
const IGNORE_FILE_EXTENSIONS = [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.bmp',
    '.tiff',
    '.tif',
    '.svg',
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.zip',
    '.rar',
    '.tar',
    '.gz',
    '.mp3',
    '.wav',
    '.ogg',
    '.mp4',
    '.avi',
    '.wmv',
    '.mov',
    '.flv'
  ];
  
//forbidden elements are meta tags that has property robots with value noindex
const FORBIDDEN_ELELMENTS = [
    'meta[name~="robots"][content~="noindex"]', 
    'meta[name~="robots"][content~="nofollow"]', 
    'meta[name~="googlebot"][content~="noindex"]', 
    'meta[name~="googlebot"][content~="nofollow"]',
    'meta[charSet~="utf-8"]', //for testing if this apprach works
    `meta`, //for testing if this approach works

];

const testedUrls = [];

//function to load website, check for forbidden links, collect all valid links and crawl them to check for forbidden links
async function checkPageForSelectors(url, elementsSelectors = null){
    if(elementsSelectors === null){
        elementsSelectors = FORBIDDEN_ELELMENTS;
    }
    console.log(`Crawling ${url}`);
    //launch browser
    const browser = await chromium.launch();
    //create new page
    const page = await browser.newPage();
    //go to url
    await page.goto(url);
    //TEST CURRENT PAGE FOR FORBIDDEN ELEMENTS
    console.log(`page loaded: ${url}`)
    
    const faulty = await page.evaluate(
        async (lookFor) => {
            let foundFault = false;
            let faultyLink = {
                url: document.URL,
                forbiddenElements: []
            }
            //loop through forbidden elements
            for (const element of lookFor) {
                console.log(`looking for ${element}`)
                //get the elements that match the selector
                const elements = document.querySelectorAll(element);
                //get the url of the page
                const url = document.URL;
                //check if there are any elements
                if(elements.length > 0){
                    //if the element is present, log the url and the element
                    console.log(`Page ${url} has a ${element} element`);
                    //add the element to the faultyLink object
                    faultyLink.forbiddenElements.push(element);
                    
                }
                else {
                    //if the element is not present, log the url and the element
                    console.log(`Page ${url} does not have a ${element} element`);
                }
            }
            return faultyLink;
        }, elementsSelectors
    );
    console.log(faulty);
    await browser.close();
    return faulty;

}
//scans the page for valid links and returns an array of valid links
async function collectPagesValidLinks(url, ignoreUrls = [], ignoreFileExtensions=null){
    if(ignoreFileExtensions === null){
        ignoreFileExtensions = IGNORE_FILE_EXTENSIONS;
    }
    const browser = await chromium.launch();
    //create new page
    const page = await browser.newPage();
    //load url
    await page.goto(url);
    //COLLECT ALL LINKS ON THE PAGE
    const validLinks = [];

    //locate all links on the page
    const linksLocator = page.locator('a');
    const links = await linksLocator.elementHandles();

    //extract http or https and domain name from the url
    const domain = url.match(/(https?:\/\/)?(www.)?([a-zA-Z0-9-]+)(\.[a-zA-Z0-9-]+)+/)[0];
    console.log(`extracted domain: ${domain}`);


    for (const link of links) {
        //get the href attribute of all links
        let href = await link.getAttribute('href');
        console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`);
        
        //print the hrefs
        console.log(`Checking links href: ${href}`)
        //check if the href is:
        //not null
        //not empty
        //not a javascript link
        //not a mailto link
        //not a tel link
        //not a link to the same page
        //not already in the validLinks array
        if(href && href !== '#' && !href.startsWith('javascript') && !href.startsWith('mailto') && !href.startsWith('tel') && !href.startsWith('#')){
            //check if the link is on the same page in the last part of the url in the form of domain.extention/.../example#id
            
            //check if href ends with a file extension
            if(/^.*\/.*\.[a-zA-Z0-9]+.*$/.test(href)){
                console.log(`Link ${href} is matching a file format, checking...`);
                //split the href by /
                const splitHref = href.split('/');
                //take the last part of the href
                const lastPart = splitHref.pop();
                //check if last part contains any of the extensions to ignore
                if(ignoreFileExtensions.some(ext => lastPart.includes(ext))){
                    console.log(`Link ${href} is matching a file format to ignore, skipping...`);
                    continue;
                }
                else {
                    console.log(`Link ${href} is not matching a file format to ignore, continuing...`);
                }
            }
            //split the href by /
            if(href.includes('#')){
                const splitHref = href.split('/');
                //console.log(`split href: ${splitHref}`)

                //get the last part of the href 
                const lastPart = splitHref.pop()
                //console.log(`first part: ${splitHref}, last part: ${lastPart}`)

                //check if the last part of the href contains a #
                if(lastPart.length > 1){
                    if(lastPart.includes('#')){
                        //console.log(`checking for #: ${lastPart}`);
                        //console.log(`found #, extracting...`);
                        const splitByHash = lastPart.split('#')
                        //remove the last element from the splitHref array
                    
                        const keptPart = splitByHash.slice(0, -1);
                        const removedPart = splitByHash.slice(-1);
                        //console.log(`removed part #${removedPart}`);
                        //keep the whole split except the last part
                        //console.log(`keeping part ${keptPart}`);
                        splitHref.push(keptPart);
                        //console.log(splitHref)
                        const newHref = splitHref.join('/');
                        href = newHref
                        console.log(`Included #id ref, updated href: ${href}`);

                    }
                }
            }

            
            //delete last slash from the url
            if(url.endsWith('/')){
                url = url.slice(0, -1);
            }
            //check if link is relative and if so, make it absolute
            if(href.startsWith('/')){
                href = domain + href;
                console.log(`Href was relative, updated href: ${href}`);

            }
            //check if link is included in the ignoreUrls array
            if(ignoreUrls.includes(href)){
                console.log(`Link ${href} is in the ignoreUrls array, skipping...`);
                continue;
            }
            //if link belongs to a different domain, skip it
            if(!href.startsWith(domain)){
                console.log(`Link ${href} belongs to a different domain, skipping...`);
                continue;
            }
            //if link is already in the validLinks array, skip it
            if(validLinks.includes(href)){
                console.log(`Link ${href} is already in the validLinks array, skipping...`);
                continue;
            }
            //add the link to the validLinks array
            //console.log(href);
            console.log(`adding ${href} to validLinks`);
            validLinks.push(href);
        }
        else {
            console.log(`Link ${href} is not valid, skipping...`);
        }
    }
    //PAGE'S LINKS GATHERED
    console.log(`Links gathered for ${url}`);
    // console.log('tested urls: ', testedUrls);
    // console.log('failed urls: ', failedUrls);
    console.log('valid links: ', validLinks);
    await browser.close();
    return validLinks;
}


async function crawlPage(url, depth = 0, maxAgents = 4){
    //spit url by to get the domain name
    const domain = url.match(/^(?:https?:)?(?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/im)[1];
    console.log(`extracted domain: ${domain}`)
    const saveDir = `./logs/${domain}/`;
    const browser = await chromium.launch();
    //create new page
    const page = await browser.newPage();
    //load url
    await page.goto(url);
    console.log(`Crawling page ${url} with depth ${depth}`);
    //COLLECT ALL LINKS ON THE PAGE
    let validLinks = [];
    let depthLinks = [];

   
    while(depth >= 0){
        let newLinks;
        let linksAvailable = 0;
        if(depthLinks.length === 0){
            console.log(`depthLinks is empty, collecting links for ${url}`);
            newLinks = await collectPagesValidLinks(url);
            linksAvailable = newLinks.length;
            if(linksAvailable === 0){
                console.log(`no new links found, breaking...`);
                break;
            }
            depthLinks.push(...newLinks);
        }
        else {
            console.log(`depthLinks is not empty, collecting links for ${depthLinks.length} links`);
            //batch links
            //count how many links are to be processed
            let linksNumber = depthLinks.length;
            let numberOfBatches = Math.ceil(linksNumber / maxAgents);
            //calculate how many links will be processed in each batch
            let linksPerBatch = Math.ceil(linksNumber / numberOfBatches);
            //create an array of batches
            let batches = [];
            //create a batch
            let batch = [];
            console.log(`BATCHING: linksNumber: ${linksNumber}, linksPerBatch: ${linksPerBatch}, numberOfBatches: ${numberOfBatches}`);
            //loop through the links and batch process them
            for(let i = 0; i < linksNumber; i++){
                //if the batch is full, add it to the batches array and create a new one
                if(batch.length === linksPerBatch || i === linksNumber - 1){
                    batches.push(batch);
                    console.log(`batch ${batch} added to batches`);
                    batch = [];
                }
                console.log(`adding ${depthLinks[i]} to batch`);
                //add the link to the batch
                batch.push(depthLinks[i]);
            }
            const promises = [];
            for(const batch of batches){
                let ignoreLinks = [...depthLinks, ...validLinks];
                for(const link of batch){
                    console.log(`collecting links for ${link}`)
                    promises.push(collectPagesValidLinks(link, ignoreLinks));
                }
                const results = await Promise.all(promises);    
                //merge the results
                const batchLinks = [];
                for(const result of results){
                    if(result.length > 0){
                        batchLinks.push(...result);
                        //remove duplicates
                        const uniqueResults = [...new Set(batchLinks)];
                        //add the links to the depthLinks array
                        depthLinks.push(...uniqueResults);   
                    }
                }
          
            }

            linksAvailable = depthLinks.length;

            if(linksAvailable === 0){
                console.log(`no new links found.`);
            }
            console.log(`new links found. Processing...`);
            depthLinks = [...new Set(depthLinks)];
            console.log(`added ${linksAvailable.length} new links to ${validLinks.length} validLinks`);
            validLinks.push(...depthLinks);
            continue;
            
        }

        console.log(`saving checkpoint for ${url} with depth ${depth}...`);
        saveLogs(depthLinks, `${domain}-${depth}`, saveDir);    
        depth--;


    }
    console.log(`total gathered links: ${validLinks.length}`);
    //close browser
    console.log(`closing browser...`);
    await browser.close();
    console.log(`processing links...`);
    validLinks = [...new Set(validLinks)];
    return validLinks;
}

//takes an array of links and saves them to a file
async function saveLogs(logs, fileName, path = `./logs/`) {
    //check if the path exists
    if (!fs.existsSync(path)) {
        //if not, create it
        fs.mkdirSync(path);
        console.log(`Created directory ${path}`);
    }
    //make save path, make sure to add a slash between the path and the file name if the path doesn't end with a slash 
    
    path = path.endsWith('/') ? path : path + '/';
    fileName = fileName.endsWith('.txt') ? fileName : fileName + '.txt';
    const savePath = path + fileName;
    //convert the array to string separated by new lines
    const logsString = logs.join('\n');    
    //write the logs to the file
    fs.writeFile(savePath, logsString, (err) => {
        if(err){
            console.log(`Error writing file: ${err}`);
        }
        else {
            console.log(`File saved to ${savePath}`);
        }
    });
}
async function scan(url,depth, saveFileAs, logDir='./logs/'){
    const links = await crawlPage(url, depth);
    //save the links to a file
    await saveLogs(links, saveFileAs, logDir);
    console.log('done');
}

// scan('https://www.24mx.com', 0, '24mx0', './logs/');
// scan('https://sledstore.se', 0, 'sledstore0', './logs/');
// scan('https://xlmoto.ie', 0, 'xlmoto0', './logs/');

// scan('https://www.24mx.com', 1, '24mx1', './logs/');
// scan('https://sledstore.se', 1, 'sledstore1', './logs/');
// scan('https://xlmoto.ie', 1, 'xlmoto1', './logs/');

// scan('https://www.24mx.com', 2, '24mx2', './logs/');
// scan('https://sledstore.se', 2, 'sledstore2', './logs/');
// scan('https://xlmoto.ie', 2, 'xlmoto2', './logs/');

// scan('https://www.24mx.com', 3, '24mx3', './logs/');
// scan('https://sledstore.se', 3, 'sledstore3', './logs/');
// scan('https://xlmoto.ie', 3, 'xlmoto3', './logs/');


//checkPageForSelectors(`https://www.24mx.com`, FORBIDDEN_ELELMENTS, `24mx0.json`, `./logs/24mx/`)
crawlPage(`https://24mx-ie-inttest01.pierce-ecom.com/brands/abus`, 1, 4);