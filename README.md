# Big Cheese Application
An application that hooks up to the Webull API to serve data to a front-end dash board

## Road map
Version 1 of this application should have the following:

- Front end dashboard which displays
    - Total value of all accounts
    - individual value of accounts
    - account composition
    - historical data graph of total value over time

- Backend API should
    - Serve all relevant data to the front end dashboard
    - Store data from webull in a DB (sqlite for now, postgres later)
        - account balances total
        - account assets
        - historical account balances total
    - Run an hourly process to mine webull for account information
        - when connected to multiple accounts, should cycle through available acounts
## References
NOTE: use these for v2
Use https://github.com/goldbergyoni/nodebestpractices to figure out file structure (best practices)
Use https://expressjs.com/en/guide/routing/ for proper routing and middleware uses
Use https://www.cosmicpython.com/book/preface for architecture patterns

USE https://typecraft.dev/education/courses/docker-for-newbs for DOCKER intro (need for postgres db...)
