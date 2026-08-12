/* =========================================================
   SHELDON ISD
   NEWS & UPDATES DISPLAY
   VERSION 1.9
   FACEBOOK + INSTAGRAM COMBINED
   48 HOUR FILTER
   STATIC SHELDON ISD LOGO
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const CONFIG = {

    /* -----------------------------------------------------
       FACEBOOK RSS.APP JSON FEED
       ----------------------------------------------------- */

    FACEBOOK_FEED_URL:
        "https://rss.app/feeds/v1.1/TkhDRIKAbXGpw8hG.json",


    /* -----------------------------------------------------
       INSTAGRAM RSS.APP JSON FEED
       ----------------------------------------------------- */

    INSTAGRAM_FEED_URL:
        "https://rss.app/feeds/v1.1/N2dPYFDIS3ukLGDC.json",


    /* -----------------------------------------------------
       REFRESH RSS FEEDS EVERY 5 MINUTES
       ----------------------------------------------------- */

    FEED_REFRESH_MS:
        5 * 60 * 1000,


    /* -----------------------------------------------------
       ONLY SHOW POSTS FROM LAST 48 HOURS
       ----------------------------------------------------- */

    MAX_POST_AGE_MS:
        2 * 24 * 60 * 60 * 1000,


    /* -----------------------------------------------------
       POST TIMING
       ----------------------------------------------------- */

    MIN_POST_TIME_MS:
        20000,


    MAX_POST_TIME_MS:
        60000,


    /* -----------------------------------------------------
       SCROLL SETTINGS
       ----------------------------------------------------- */

    SCROLL_START_DELAY_MS:
        3000,


    SCROLL_END_DELAY_MS:
        2500,


    SCROLL_PIXELS_PER_SECOND:
        28,


    /* -----------------------------------------------------
       MAXIMUM UNIQUE ANNOUNCEMENTS
       ----------------------------------------------------- */

    MAX_POSTS:
        10

};


/* =========================================================
   APPLICATION STATE
   ========================================================= */

const state = {

    posts: [],

    currentIndex: 0,

    isLoading: false,

    rotationTimer: null,

    scrollTimer: null,

    scrollAnimation: null,

    lastSuccessfulUpdate: null

};


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const elements = {

    loadingScreen:
        document.getElementById(
            "loadingScreen"
        ),

    errorScreen:
        document.getElementById(
            "errorScreen"
        ),

    errorMessage:
        document.getElementById(
            "errorMessage"
        ),

    newsCard:
        document.getElementById(
            "newsCard"
        ),

    newsImage:
        document.getElementById(
            "newsImage"
        ),

    imageFallback:
        document.getElementById(
            "imageFallback"
        ),

    newsAuthor:
        document.getElementById(
            "newsAuthor"
        ),

    newsDate:
        document.getElementById(
            "newsDate"
        ),

    newsTitle:
        document.getElementById(
            "newsTitle"
        ),

    newsBody:
        document.getElementById(
            "newsBody"
        ),

    postNumber:
        document.getElementById(
            "postNumber"
        ),

    pageCurrent:
        document.getElementById(
            "pageCurrent"
        ),

    pageTotal:
        document.getElementById(
            "pageTotal"
        ),

    connectionStatus:
        document.getElementById(
            "connectionStatus"
        ),

    currentDate:
        document.getElementById(
            "currentDate"
        ),

    lastUpdated:
        document.getElementById(
            "lastUpdated"
        ),

    sourceLabel:
        document.querySelector(
            ".facebook-label"
        )

};


/* =========================================================
   START APPLICATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    startApplication
);


function startApplication() {

    updateCurrentDate();


    setInterval(
        updateCurrentDate,
        30000
    );


    loadFeeds();


    setInterval(
        loadFeeds,
        CONFIG.FEED_REFRESH_MS
    );

}


/* =========================================================
   LOAD FACEBOOK + INSTAGRAM
   ========================================================= */

async function loadFeeds() {

    if (
        state.isLoading
    ) {

        return;

    }


    state.isLoading =
        true;


    setConnectionStatus(
        "CONNECTING",
        false
    );


    try {

        /*
         * Load both feeds at the same time.
         */

        const results =
            await Promise.allSettled(
                [

                    fetchFeed(
                        CONFIG.FACEBOOK_FEED_URL,
                        "Facebook"
                    ),

                    fetchFeed(
                        CONFIG.INSTAGRAM_FEED_URL,
                        "Instagram"
                    )

                ]
            );


        let combinedPosts =
            [];


        /* -------------------------------------------------
           FACEBOOK
           ------------------------------------------------- */

        if (
            results[0].status ===
            "fulfilled"
        ) {

            combinedPosts =
                combinedPosts.concat(
                    results[0].value
                );

        }
        else {

            console.warn(
                "Facebook feed unavailable:",
                results[0].reason
            );

        }


        /* -------------------------------------------------
           INSTAGRAM
           ------------------------------------------------- */

        if (
            results[1].status ===
            "fulfilled"
        ) {

            combinedPosts =
                combinedPosts.concat(
                    results[1].value
                );

        }
        else {

            console.warn(
                "Instagram feed unavailable:",
                results[1].reason
            );

        }


        /* -------------------------------------------------
           MERGE DUPLICATE ANNOUNCEMENTS
           ------------------------------------------------- */

        combinedPosts =
            mergeDuplicateAnnouncements(
                combinedPosts
            );


        /* -------------------------------------------------
           NEWEST FIRST
           ------------------------------------------------- */

        combinedPosts.sort(
            (a, b) =>
                b.timestamp -
                a.timestamp
        );


        /* -------------------------------------------------
           LIMIT NUMBER OF ANNOUNCEMENTS
           ------------------------------------------------- */

        combinedPosts =
            combinedPosts.slice(
                0,
                CONFIG.MAX_POSTS
            );


        /* -------------------------------------------------
           CHECK FOR VALID DATA
           ------------------------------------------------- */

        if (
            !combinedPosts.length
        ) {

            throw new Error(
                "No recent Sheldon ISD Facebook or Instagram posts were found."
            );

        }


        /* -------------------------------------------------
           UPDATE DISPLAY
           ------------------------------------------------- */

        updatePosts(
            combinedPosts
        );


        state.lastSuccessfulUpdate =
            new Date();


        setConnectionStatus(
            "LIVE",
            true
        );


        updateLastUpdated();

    }

    catch (
        error
    ) {

        console.error(
            "Social media feed error:",
            error
        );


        setConnectionStatus(
            "OFFLINE",
            false
        );


        /*
         * Keep existing posts if the feeds
         * temporarily become unavailable.
         */

        if (
            !state.posts.length
        ) {

            showError(
                "The Sheldon ISD social media feeds are temporarily unavailable. The display will automatically retry."
            );

        }

    }

    finally {

        state.isLoading =
            false;

    }

}


/* =========================================================
   FETCH ONE RSS FEED
   ========================================================= */

async function fetchFeed(
    feedURL,
    platform
) {

    const response =
        await fetch(
            feedURL,
            {
                method:
                    "GET",

                cache:
                    "no-store"
            }
        );


    if (
        !response.ok
    ) {

        throw new Error(
            `${platform} feed returned HTTP ${response.status}`
        );

    }


    const data =
        await response.json();


    if (
        !data ||
        !Array.isArray(
            data.items
        )
    ) {

        throw new Error(
            `${platform} feed returned an invalid format.`
        );

    }


    /*
     * Convert RSS items into our
     * standardized post format.
     */

    let posts =
        data.items

            .map(
                item =>
                    normalizePost(
                        item,
                        platform
                    )
            )

            .filter(
                post =>
                    post !== null
            );


    /*
     * Only keep posts published during
     * the last 48 hours.
     */

    posts =
        posts.filter(
            post =>
                isRecentPost(
                    post
                )
        );


    return posts;

}


/* =========================================================
   NORMALIZE RSS POST
   ========================================================= */

function normalizePost(
    item,
    platform
) {

    if (
        !item ||
        typeof item !== "object"
    ) {

        return null;

    }


    /* -----------------------------------------------------
       RAW CONTENT
       ----------------------------------------------------- */

    const rawText =
        item.content_text ||
        item.description ||
        item.content ||
        "";


    const cleanedRawText =
        cleanText(
            stripHtml(
                rawText
            )
        );


    /* -----------------------------------------------------
       TITLE
       ----------------------------------------------------- */

    let title =
        cleanText(
            item.title ||
            ""
        );


    /* -----------------------------------------------------
       CONTENT LINES
       ----------------------------------------------------- */

    const lines =
        cleanedRawText

            .split(
                "\n"
            )

            .map(
                line =>
                    cleanText(
                        line
                    )
            )

            .filter(
                line =>
                    line.length > 0
            );


    /*
     * If RSS doesn't provide a title,
     * use the first line of the post.
     */

    if (
        !title &&
        lines.length
    ) {

        title =
            lines[0];

    }


    /* -----------------------------------------------------
       REMOVE PLACEHOLDER POSTS
       ----------------------------------------------------- */

    if (
        isPlaceholderPost(
            title,
            cleanedRawText
        )
    ) {

        return null;

    }


    /* -----------------------------------------------------
       BODY
       ----------------------------------------------------- */

    let body =
        cleanedRawText;


    /*
     * Remove title if RSS repeated it
     * at the beginning of the body.
     */

    if (
        title &&
        body
            .toLowerCase()
            .startsWith(
                title.toLowerCase()
            )
    ) {

        body =
            body
                .slice(
                    title.length
                )
                .trim();

    }


    /*
     * Remove duplicate first line.
     */

    if (
        lines.length > 1 &&
        lines[0]
            .toLowerCase() ===
        title
            .toLowerCase()
    ) {

        body =
            lines
                .slice(1)
                .join(
                    "\n"
                );

    }


    /*
     * Reject empty posts.
     */

    if (
        !body ||
        body.length < 5
    ) {

        return null;

    }


    /* -----------------------------------------------------
       AUTHOR
       ----------------------------------------------------- */

    let author =
        "Sheldon ISD";


    if (
        platform ===
        "Instagram"
    ) {

        author =
            "Sheldon ISD";

    }


    if (
        Array.isArray(
            item.authors
        ) &&
        item.authors.length
    ) {

        author =
            cleanText(
                item.authors[0].name ||
                author
            );

    }


    /* -----------------------------------------------------
       DATE
       ----------------------------------------------------- */

    const date =
        parseDate(
            item.date_published ||
            item.pubDate ||
            item.date_modified
        );


    /* -----------------------------------------------------
       ID
       ----------------------------------------------------- */

    const id =
        item.id ||
        item.url ||
        `${platform}-${title}-${date.getTime()}`;


    return {

        id:
            id,

        platform:
            platform,

        title:
            title ||
            "Sheldon ISD News",

        body:
            body,

        author:
            author,

        date:
            date,

        timestamp:
            date.getTime(),

        url:
            item.url ||
            ""

    };

}


/* =========================================================
   48-HOUR FILTER
   ========================================================= */

function isRecentPost(
    post
) {

    if (
        !post ||
        !post.date
    ) {

        return false;

    }


    const now =
        Date.now();


    const postTime =
        post.timestamp;


    const age =
        now -
        postTime;


    /*
     * Reject future-dated posts.
     */

    if (
        age < 0
    ) {

        return false;

    }


    /*
     * Reject posts older than
     * 48 hours.
     */

    if (
        age >
        CONFIG.MAX_POST_AGE_MS
    ) {

        return false;

    }


    return true;

}


/* =========================================================
   PLACEHOLDER FILTER
   ========================================================= */

function isPlaceholderPost(
    title,
    content
) {

    const titleText =
        cleanText(
            title
        )
            .toLowerCase();


    const contentText =
        cleanText(
            content
        )
            .toLowerCase();


    /*
     * Known Facebook RSS placeholder.
     */

    if (
        titleText ===
        "sheldon isd posted"
    ) {

        return true;

    }


    /*
     * Generic placeholders.
     */

    const placeholderTitles = [

        "sheldon isd posted",

        "facebook post",

        "instagram post",

        "new post",

        "posted"

    ];


    if (
        placeholderTitles.includes(
            titleText
        ) &&
        contentText.length < 80
    ) {

        return true;

    }


    /*
     * Exact placeholder content.
     */

    if (
        contentText ===
        "sheldon isd posted"
    ) {

        return true;

    }


    return false;

}


/* =========================================================
   MERGE FACEBOOK + INSTAGRAM
   =========================================================
   
   If Facebook and Instagram contain the
   same announcement, it becomes ONE card.

   Example:

   Facebook:
   "Back to School Reminder"

   Instagram:
   "Back to School Reminder"

   Result:

   ONE CARD

   Source:
   FACEBOOK + INSTAGRAM
   ========================================================= */

function mergeDuplicateAnnouncements(
    posts
) {

    const merged =
        new Map();


    posts.forEach(
        post => {

            /*
             * Create a normalized text key.
             *
             * We intentionally use the title
             * and body rather than the RSS ID
             * because Facebook and Instagram
             * have different IDs for the same post.
             */

            const textKey =
                (
                    post.title +
                    "|" +
                    post.body
                )
                    .toLowerCase()
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();


            /*
             * Already have this announcement.
             */

            if (
                merged.has(
                    textKey
                )
            ){

                const existing =
                    merged.get(
                        textKey
                    );


                /*
                 * Add the second platform.
                 */

                if (
                    !existing.platforms.includes(
                        post.platform
                    )
                ) {

                    existing.platforms.push(
                        post.platform
                    );

                }


                /*
                 * Keep the newest publication date.
                 */

                if (
                    post.timestamp >
                    existing.timestamp
                ) {

                    existing.date =
                        post.date;

                    existing.timestamp =
                        post.timestamp;

                }


                /*
                 * Keep a valid URL if the
                 * original card doesn't have one.
                 */

                if (
                    !existing.url &&
                    post.url
                ) {

                    existing.url =
                        post.url;

                }

            }

            else {

                /*
                 * First occurrence.
                 */

                merged.set(
                    textKey,
                    {

                        ...post,

                        platforms:
                            [
                                post.platform
                            ]

                    }
                );

            }

        }
    );


    return Array.from(
        merged.values()
    );

}


/* =========================================================
   UPDATE POSTS
   ========================================================= */

function updatePosts(
    newPosts
) {

    const oldPost =
        state.posts[
            state.currentIndex
        ];


    const oldPostId =
        oldPost
            ? oldPost.id
            : null;


    state.posts =
        newPosts;


    /*
     * Try to stay on the same announcement
     * after a feed refresh.
     */

    if (
        oldPostId
    ) {

        const matchingIndex =
            state.posts.findIndex(
                post =>
                    post.id ===
                    oldPostId
            );


        if (
            matchingIndex >= 0
        ) {

            state.currentIndex =
                matchingIndex;

        }

        else if (
            state.currentIndex >=
            state.posts.length
        ) {

            state.currentIndex =
                0;

        }

    }


    updatePageIndicator();


    /*
     * First successful load.
     */

    if (
        elements.newsCard &&
        elements.newsCard.classList.contains(
            "hidden"
        )
    ) {

        hideLoading();

        hideError();

        displayCurrentPost(
            false
        );

        return;

    }

}


/* =========================================================
   DISPLAY CURRENT POST
   ========================================================= */

function displayCurrentPost(
    animate = true
) {

    if (
        !state.posts.length
    ) {

        return;

    }


    const post =
        state.posts[
            state.currentIndex
        ];


    if (!post) {

        return;

    }


    stopScroll();

    clearRotationTimer();


    if (
        animate
    ) {

        elements.newsCard.classList.remove(
            "fade-in"
        );


        elements.newsCard.classList.add(
            "fade-out"
        );


        setTimeout(
            () => {

                renderPost(
                    post
                );

            },
            250
        );

    }

    else {

        renderPost(
            post
        );

    }

}


/* =========================================================
   RENDER POST
   ========================================================= */

function renderPost(
    post
) {

    /* -----------------------------------------------------
       AUTHOR
       ----------------------------------------------------- */

    if (
        elements.newsAuthor
    ) {

        elements.newsAuthor.textContent =
            post.author;

    }


    /* -----------------------------------------------------
       DATE
       ----------------------------------------------------- */

    if (
        elements.newsDate
    ) {

        elements.newsDate.textContent =
            formatDate(
                post.date
            );

    }


    /* -----------------------------------------------------
       TITLE
       ----------------------------------------------------- */

    if (
        elements.newsTitle
    ) {

        elements.newsTitle.textContent =
            post.title;

    }


    /* -----------------------------------------------------
       FULL POST BODY
       ----------------------------------------------------- */

    if (
        elements.newsBody
    ) {

        elements.newsBody.textContent =
            post.body;


        elements.newsBody.scrollTop =
            0;

    }


    /* -----------------------------------------------------
       SOURCE LABEL
       ----------------------------------------------------- */

    updateSourceLabel(
        post
    );


    /* -----------------------------------------------------
       PAGE NUMBER
       ----------------------------------------------------- */

    updatePageIndicator();


    /* =====================================================
       STATIC SHELDON ISD LOGO
       
       NEVER USE RSS IMAGES.
       ===================================================== */

    if (
        elements.newsImage
    ) {

        elements.newsImage.classList.add(
            "hidden"
        );


        elements.newsImage.removeAttribute(
            "src"
        );

    }


    if (
        elements.imageFallback
    ) {

        elements.imageFallback.classList.remove(
            "hidden"
        );

    }


    /* -----------------------------------------------------
       SHOW CARD
       ----------------------------------------------------- */

    elements.newsCard.classList.remove(
        "hidden"
    );


    elements.newsCard.classList.remove(
        "fade-out"
    );


    void elements.newsCard.offsetWidth;


    elements.newsCard.classList.add(
        "fade-in"
    );


    /* -----------------------------------------------------
       PREPARE SCROLL
       ----------------------------------------------------- */

    requestAnimationFrame(
        () => {

            setTimeout(
                preparePostTiming,
                350
            );

        }
    );

}


/* =========================================================
   UPDATE SOURCE LABEL
   ========================================================= */

function updateSourceLabel(
    post
) {

    if (
        !elements.sourceLabel
    ) {

        return;

    }


    const platforms =
        post.platforms ||
        [
            post.platform
        ];


    /*
     * Convert:
     *
     * Facebook
     *
     * Instagram
     *
     * Facebook + Instagram
     */

    const label =
        platforms
            .map(
                platform =>
                    String(
                        platform
                    ).toUpperCase()
            )
            .join(
                " + "
            );


    elements.sourceLabel.textContent =
        label;

}


/* =========================================================
   PREPARE POST TIMING
   ========================================================= */

function preparePostTiming() {

    const body =
        elements.newsBody;


    if (
        !body
    ) {

        scheduleNextPost(
            CONFIG.MIN_POST_TIME_MS
        );


        return;

    }


    stopScroll();


    body.scrollTop =
        0;


    /*
     * Calculate how much content
     * exists below the visible area.
     */

    const scrollDistance =
        Math.max(
            0,
            body.scrollHeight -
            body.clientHeight
        );


    /*
     * Short post:
     * Everything fits on screen.
     */

    if (
        scrollDistance <= 5
    ) {

        scheduleNextPost(
            CONFIG.MIN_POST_TIME_MS
        );


        return;

    }


    /*
     * Long post:
     * Calculate scrolling time.
     */

    const estimatedScrollTime =
        (
            scrollDistance /
            CONFIG.SCROLL_PIXELS_PER_SECOND
        )
        *
        1000;


    let totalTime =
        CONFIG.SCROLL_START_DELAY_MS +
        estimatedScrollTime +
        CONFIG.SCROLL_END_DELAY_MS;


    /*
     * Minimum display time.
     */

    totalTime =
        Math.max(
            totalTime,
            CONFIG.MIN_POST_TIME_MS
        );


    /*
     * Maximum display time.
     */

    totalTime =
        Math.min(
            totalTime,
            CONFIG.MAX_POST_TIME_MS
        );


    /*
     * Begin scrolling.
     */

    startScroll(
        scrollDistance
    );


    /*
     * Move to next announcement
     * when the time is complete.
     */

    scheduleNextPost(
        totalTime
    );

}


/* =========================================================
   START SCROLL
   ========================================================= */

function startScroll(
    scrollDistance
) {

    stopScroll();


    if (
        scrollDistance <= 5
    ) {

        return;

    }


    state.scrollTimer =
        setTimeout(
            () => {

                animateScroll(
                    scrollDistance
                );

            },
            CONFIG.SCROLL_START_DELAY_MS
        );

}


/* =========================================================
   ANIMATE SCROLL
   ========================================================= */

function animateScroll(
    scrollDistance
) {

    const body =
        elements.newsBody;


    if (
        !body
    ) {

        return;

    }


    const startTime =
        performance.now();


    const startPosition =
        body.scrollTop;


    const duration =
        (
            scrollDistance /
            CONFIG.SCROLL_PIXELS_PER_SECOND
        )
        *
        1000;


    function step(
        currentTime
    ) {

        const elapsed =
            currentTime -
            startTime;


        const progress =
            Math.min(
                elapsed /
                duration,
                1
            );


        body.scrollTop =
            startPosition +
            (
                scrollDistance -
                startPosition
            )
            *
            progress;


        if (
            progress < 1
        ) {

            state.scrollAnimation =
                requestAnimationFrame(
                    step
                );

        }

        else {

            state.scrollAnimation =
                null;

        }

    }


    state.scrollAnimation =
        requestAnimationFrame(
            step
        );

}


/* =========================================================
   STOP SCROLL
   ========================================================= */

function stopScroll() {

    if (
        state.scrollTimer
    ) {

        clearTimeout(
            state.scrollTimer
        );


        state.scrollTimer =
            null;

    }


    if (
        state.scrollAnimation
    ) {

        cancelAnimationFrame(
            state.scrollAnimation
        );


        state.scrollAnimation =
            null;

    }

}


/* =========================================================
   SCHEDULE NEXT POST
   ========================================================= */

function scheduleNextPost(
    duration
) {

    clearRotationTimer();


    state.rotationTimer =
        setTimeout(
            () => {

                nextPost();

            },
            duration
        );

}


/* =========================================================
   CLEAR ROTATION TIMER
   ========================================================= */

function clearRotationTimer() {

    if (
        state.rotationTimer
    ) {

        clearTimeout(
            state.rotationTimer
        );


        state.rotationTimer =
            null;

    }

}


/* =========================================================
   NEXT POST
   ========================================================= */

function nextPost() {

    if (
        state.posts.length <= 1
    ) {

        preparePostTiming();


        return;

    }


    stopScroll();

    clearRotationTimer();


    state.currentIndex =
        (
            state.currentIndex +
            1
        )
        %
        state.posts.length;


    updatePageIndicator();


    displayCurrentPost(
        true
    );

}


/* =========================================================
   PREVIOUS POST
   ========================================================= */

function previousPost() {

    if (
        state.posts.length <= 1
    ) {

        return;

    }


    stopScroll();

    clearRotationTimer();


    state.currentIndex =
        (
            state.currentIndex -
            1 +
            state.posts.length
        )
        %
        state.posts.length;


    updatePageIndicator();


    displayCurrentPost(
        true
    );

}


/* =========================================================
   PAGE INDICATOR
   ========================================================= */

function updatePageIndicator() {

    const current =
        state.posts.length
            ? state.currentIndex + 1
            : 1;


    const total =
        state.posts.length ||
        1;


    if (
        elements.pageCurrent
    ) {

        elements.pageCurrent.textContent =
            current;

    }


    if (
        elements.pageTotal
    ) {

        elements.pageTotal.textContent =
            total;

    }


    if (
        elements.postNumber
    ) {

        elements.postNumber.textContent =
            `${current} / ${total}`;

    }

}


/* =========================================================
   HIDE LOADING
   ========================================================= */

function hideLoading() {

    if (
        elements.loadingScreen
    ) {

        elements.loadingScreen.classList.add(
            "hidden"
        );

    }

}


/* =========================================================
   HIDE ERROR
   ========================================================= */

function hideError() {

    if (
        elements.errorScreen
    ) {

        elements.errorScreen.classList.add(
            "hidden"
        );

    }

}


/* =========================================================
   SHOW ERROR
   ========================================================= */

function showError(
    message
) {

    hideLoading();


    if (
        elements.newsCard
    ) {

        elements.newsCard.classList.add(
            "hidden"
        );

    }


    if (
        elements.errorScreen
    ) {

        elements.errorScreen.classList.remove(
            "hidden"
        );

    }


    if (
        elements.errorMessage
    ) {

        elements.errorMessage.textContent =
            message;

    }

}


/* =========================================================
   CONNECTION STATUS
   ========================================================= */

function setConnectionStatus(
    status,
    online
) {

    if (
        !elements.connectionStatus
    ) {

        return;

    }


    elements.connectionStatus.textContent =
        status;


    elements.connectionStatus.classList.toggle(
        "offline",
        !online
    );

}


/* =========================================================
   CURRENT DATE
   ========================================================= */

function updateCurrentDate() {

    if (
        !elements.currentDate
    ) {

        return;

    }


    const now =
        new Date();


    elements.currentDate.textContent =
        now.toLocaleDateString(
            "en-US",
            {
                weekday:
                    "long",

                month:
                    "long",

                day:
                    "numeric",

                year:
                    "numeric"
            }
        );

}


/* =========================================================
   LAST UPDATED
   ========================================================= */

function updateLastUpdated() {

    if (
        !elements.lastUpdated ||
        !state.lastSuccessfulUpdate
    ) {

        return;

    }


    elements.lastUpdated.textContent =
        "Updated " +
        state.lastSuccessfulUpdate.toLocaleTimeString(
            "en-US",
            {
                hour:
                    "numeric",

                minute:
                    "2-digit"
            }
        );

}


/* =========================================================
   DATE PARSER
   ========================================================= */

function parseDate(
    value
) {

    if (
        !value
    ) {

        return new Date();

    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return new Date();

    }


    return date;

}


/* =========================================================
   DATE FORMATTER
   ========================================================= */

function formatDate(
    date
) {

    if (
        !date ||
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "--";

    }


    return date.toLocaleDateString(
        "en-US",
        {
            month:
                "short",

            day:
                "numeric",

            year:
                "numeric"
        }
    );

}


/* =========================================================
   STRIP HTML
   ========================================================= */

function stripHtml(
    html
) {

    if (
        !html
    ) {

        return "";

    }


    const temp =
        document.createElement(
            "div"
        );


    temp.innerHTML =
        html;


    return (
        temp.textContent ||
        temp.innerText ||
        ""
    );

}


/* =========================================================
   CLEAN TEXT
   ========================================================= */

function cleanText(
    text
) {

    if (
        text === null ||
        text === undefined
    ) {

        return "";

    }


    return String(text)

        .replace(
            /\r\n/g,
            "\n"
        )

        .replace(
            /\r/g,
            "\n"
        )

        .replace(
            /[ \t]+/g,
            " "
        )

        .replace(
            /\n{3,}/g,
            "\n\n"
        )

        .trim();

}


/* =========================================================
   KEYBOARD CONTROLS
   ========================================================= */

document.addEventListener(
    "keydown",
    function(event) {

        /*
         * Right arrow = next
         */

        if (
            event.key ===
            "ArrowRight"
        ) {

            nextPost();

        }


        /*
         * Left arrow = previous
         */

        if (
            event.key ===
            "ArrowLeft"
        ) {

            previousPost();

        }


        /*
         * Space = next
         */

        if (
            event.key ===
            " "
        ) {

            event.preventDefault();

            nextPost();

        }

    }
);


/* =========================================================
   NETWORK RECOVERY
   ========================================================= */

window.addEventListener(
    "online",
    function() {

        loadFeeds();

    }
);


window.addEventListener(
    "offline",
    function() {

        setConnectionStatus(
            "OFFLINE",
            false
        );

    }
);


/* =========================================================
   PAGE VISIBILITY
   ========================================================= */

document.addEventListener(
    "visibilitychange",
    function() {

        if (
            !document.hidden &&
            state.posts.length
        ) {

            loadFeeds();

        }

    }
);


/* =========================================================
   INITIAL PAGE INDICATOR
   ========================================================= */

updatePageIndicator();


/* =========================================================
   END OF SCRIPT
   ========================================================= */