# Cinema Showtimes Project

## Project Purpose
This project is developed for educational purposes to demonstrate skills in React, Docker, and API integration. It provides an example of how to access and display showtimes and movie titles from a cinema's API.

## Structure and Tech Stack
This project consists of:
- A frontend (React, via Create React App)
- A backend API (ExpressJS)
- A dockerfile and docker-compose that builds and runs both the frontend and backend.

## Educational Use Disclaimer
This project is intended solely for educational purposes. It is not in a runnable state as-is (required env vars are not provided), and the code is designed to illustrate the process of fetching and displaying data from an API. The specific API endpoints used in this project are stored in environment variables and are not included in the public repository.

## Important Note
- This project does not use or replicate any proprietary designs, logos, or trademarks from any cinema.
- No security measures of any API were bypassed during any stage of development of this project.
- This project does not have any commercial purpose and should not be used for any commercial gain.
- The specific cinema's terms and conditions were closly insected to ensure strict compliance.

## API Integration Explanation
The backend code in this project is tailored to a specific cinema's API to demonstrate how to interact with such services. The methods used here can be adapted to other APIs with similar structures.

## Images
Showings Tab             |  General Attendance Tab
:-------------------------:|:-------------------------:
![A screenshot of the showings tab of the frontend, showing a chronological list of showtimes, including the movie name, rating, time of the showing, and the total number of guests booked for this showing.](/screenshots/frontend-showings.jpg "The showings tab.")  |  ![A screenshot of the attendance tab of the frontend, showing a chronological list of each hour's total number of guests, with the first list item representing the next hour.](/screenshots/frontend-attendance.jpg "The attendance tab.")

## Backend Authentication Walkthrough
When a user first visits the frontend site, it attempts to grab a `sessionId` from the URL parameters.
- If one **isn't found**, the user is shown the login page and prompted to enter a password.
- If one **is found**, the site attempts to fetch scheduling information from the backend, providing the sessionId to it. The backend will verify this sessionId and, **if it is not valid**, a 401 status code is returned with no data, with the frontend responding by kicking the user to the login page.
### Login Page
Once here, the user is prompted to enter a password (`FRONTEND_PASSWORD`). Once entered, a `GET` request is made to the backend's `authenticate` endpoint, which will return either:
- A 401 status code (*if the password is **incorrect***)
- A valid response with a randomly generated `sessionId` (*if the password is **correct***). This sessionId and time of expiry (24 hours from generation) are stored in an array on the backend.
    - Additionally, when a new sessionId is generated, all existing ones are validated to ensure they are not set to expire. If they are, they are removed from the array, thus invalidating them upon their next use.
    - If the session array is greater than the `SESSION_LIMIT` const, the oldest one will be removed before adding this one to the array. This prevents any potential memory issues from occurring.

Once entered correctly, the frontend will update the URL search params to include the provided sessionId, triggering a refresh to the page. Once refreshed, the frontend will notice the `sessionId` in the URL and display the schedule page to the user, before making a request to the backend for scheduling information (via the `showtimes` endpoint).

## Backend Data Fetching & Ethical Usage via Rate Limiting and Authentication
Once a **validated** (*see above*) **request** is made to the `showtimes` endpoint, the relevent data is fetched from the cinema's API. To maintain fair-use and avoid spamming their API, schedule refreshes are limited to once every 5 minutes and once made, are cached in memory. If a request is made less than 5 minutes before the last, the cached response is sent.

The runtime complexity of a single schedule fetch is `O(n)`, with `n` representing the number of showings scheduled for the current day.

## Setup Instructions
Before reading, please be aware that required .env files have **not been provided** with this repo. Without these, the project will not run successfully.
1. **Clone the Repository**:
    ```sh
    git clone https://github.com/JoshA02/CinemaShowtimes.git
    ```
2. **Install Dependencies**:
    ```sh
    cd CinemaShowtimes
    npm i
    ```
3. **Environment Variables**:
    1. Create a `.env` file in the root of your project.
    2. Assign the following variables. Note that some can not be explained as doing so would name the specific cinema used:
        ```
        CINEMA_WEBSITE_URL="REDACTED" # This is the frontend URL of the cinema's website
        CINEMA_QUERY_ID_REGEX="REDACTED" # This is the regex required to find the QUERY_ID from the frontend html
        QUERY_API_URL="https://cms-assets.webediamovies.pro/prod/REDACTED/{QUERY_ID}/public/page-data/cinemas/{CINEMA_ID}-REDACTED/page-data.json"
        QUERY_HASH_URL="https://cms-assets.webediamovies.pro/prod/REDACTED/{QUERY_ID}/public/page-data/sq/d/{QUERY_HASH}.json"
        SCHEDULE_API="REDACTED" # The API endpoint used to access showtime scheduling information
        CINEMA_ID="REDACTED"
        FRONTEND_URL="http://localhost:3000"
        FRONTEND_PASSWORD="password123123" # The password required for entry to your hosted frontend
        EXPRESS_PORT=3001 # The port used by express to host the backend
        ```
    3. Within the `public` folder, create an additional `.env` file with the following:
        ```
        REACT_APP_API_URL="http://localhost:3001" # The base URL of your hosted backend/API
        ```

## Usage:
<details open>
<summary><b>Windows/Linux/MacOS</b></summary>

<ol>
    <li>To run this project during development, enter the following commands (<i>in the project root directory</i>):</li>
        <code>npm run back-dev</code> to run the backend<br>
        <code>npm run front-dev</code> to run the frontend
    <li>To run during production, enter the following commands:</li>
        <code>npm run back-prod</code> to run the backend<br>
        <code>npm run front-prod</code> to run the frontend
</ol>

</details>
<details open>
<summary><b>Docker</b></summary>

To run during production, enter the following command (<i>in the project root directory</i>): <code>docker compose up --detach</code>
</details>


<br>
<br>