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




