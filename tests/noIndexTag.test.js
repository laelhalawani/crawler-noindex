const {test, expect} = require('@playwright/test');
const {readFileSync, existsSync, mkdirSync, appendFile, writeFileSync, openSync} = require('fs');


//a simple test that opens links from a file and tests them for tags that shouldn't be there
const FORBIDDEN_ELELMENTS = [
    'meta[name~="robots"][content~="noindex"]', 
    'meta[name~="robots"][content~="nofollow"]', 
    'meta[name~="googlebot"][content~="noindex"]', 
    'meta[name~="googlebot"][content~="nofollow"]',
    //'meta[charSet~="utf-8"]', //for testing if this apprach works
    //`meta`, //for testing if this approach works

];

//takes an array and outputs a new array containing only unique values
function removeDuplicates(arr) {
    const uniqueArr = [];
    arr.forEach((value) => {
      if (!uniqueArr.includes(value)) {
        uniqueArr.push(value);
      }
    });
    return uniqueArr;
}
//load links from file and removing duplicates using custom function, since I can't get Set to do the job
let LINKS_ARR = removeDuplicates(readFileSync(`./test_resources/24mx2.txt`,`utf-8`).split(`\n`));
console.log(`Loaded ${LINKS_ARR.length} unique links`);

const OUTPUT_PATH = `./tested-links/`;
if(!existsSync(OUTPUT_PATH)){
    mkdirSync(OUTPUT_PATH);
}

const OUTPUT_FILE_FAILED = `failed_links.txt`
const OUTPUT_FILE_PASSED = `passed_links.txt`
//check if the output files exist, if not, create them
if(!existsSync(`${OUTPUT_PATH}${OUTPUT_FILE_FAILED}`)){
    openSync(`${OUTPUT_PATH}${OUTPUT_FILE_FAILED}`, 'w');
}
if(!existsSync(`${OUTPUT_PATH}${OUTPUT_FILE_PASSED}`)){
    openSync(`${OUTPUT_PATH}${OUTPUT_FILE_PASSED}`, 'w');
}
const PASSED_ARR = readFileSync(`${OUTPUT_PATH}${OUTPUT_FILE_PASSED}`, `utf-8`).split(`\n`);
const FAILED_ARR = readFileSync(`${OUTPUT_PATH}${OUTPUT_FILE_FAILED}`, `utf-8`).split(`\n`);
const CHECKED_LINKS = [...PASSED_ARR, ...FAILED_ARR].filter( link => link !== ``);

console.log(`Loaded ${CHECKED_LINKS.length} checked links`);
//load the links from OUTPUT_FILE_FAILED and OUTPUT_FILE_PASSED and remove them from LINKS_ARR
LINKS_ARR = LINKS_ARR.filter((link) => {
    return !CHECKED_LINKS.includes(link);
});
console.log(`Loaded ${LINKS_ARR.length} links to test after removing checked links`);

//TEST
test('test forbidden elements', async ({page}) =>{
    let count = 0;
    for(const url of LINKS_ARR){
        await page.goto(url);
        console.log(`${count}. loaded ${url}`);
        const faulty = await page.evaluate(
            async (lookFor) => {
                let foundFault = false;
                let faultyLink = {
                    url: document.URL,
                    forbiddenElements: []
                }
                //loop through forbidden elements
                for (const element of lookFor) {
                    //console.log(`looking for ${element}`)
                    //get the elements that match the selector
                    const elements = document.querySelectorAll(element);
                    //get the url of the page
                    faultyLink.url = document.URL;
                    //check if there are any elements
                    if(elements.length > 0){
                        //if the element is present, log the url and the element
                        console.log(`Found forbidden element: ${element}`);
                        //add the element to the faultyLink object
                        faultyLink.forbiddenElements.push(element);
                        
                    }
                    else {
                        //if the element is not present, log the url and the element
                        console.log(`Page ${faultyLink.url} does not have a ${element} element`);
                    }
                }
                return faultyLink;
            }, FORBIDDEN_ELELMENTS);
        if(faulty.forbiddenElements.length>0){
            appendFile(`${OUTPUT_PATH}${OUTPUT_FILE_FAILED}`, `${faulty.url}\n`, (err) => {
                if(err) throw err;
                console.log(`Failed link saved.`);
            });
        } else {
            appendFile(`${OUTPUT_PATH}${OUTPUT_FILE_PASSED}`, `${faulty.url}\n`, (err) => {
                if(err) throw err;
                console.log(`Passed link saved.`);
            });
        }


        count++;
        expect.soft(faulty.forbiddenElements.length===0, `${faulty.url} contains ${faulty.forbiddenElements}`);
        console.log(`Complete.`);



    }
    Console.log('test complete.');

});



