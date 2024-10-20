# Browser Extension: TimeLimit

**TimeLimit** is a browser extension designed to help you stay focused by managing your browsing habits. It allows you to set time limits for specific websites, block distracting domains, and sync your preferences across multiple devices seamlessly.

## Features

- **Website Blocking and Time Management**: Set time limits for websites to control how long you spend on distracting domains. Block access to specific websites during focus hours.
- **Global Blocking Schedule**: Define focus schedules to automatically block distracting sites during particular hours and days.
- **Domain Set Synchronization**: Sync your settings and domain restrictions across all devices using Firebase.
- **Customizable Alerts**: Receive alerts when your allocated time for specific websites runs out.
- **User-Friendly Timer Display**: Easily track how much time you have left for specific sites using an intuitive visual timer.

## Installation

1. **Clone or Download the Repository**: Start by cloning this repository to your local machine or downloading the ZIP file.

   ```sh
   git clone https://github.com/your-username/timelimit-extension.git
   ```

2. **Load the Extension in Your Browser**:

   - **Chrome**: Go to `chrome://extensions/`, enable **Developer mode**, click **Load unpacked**, and select the folder where you cloned/downloaded the extension.
   - **Firefox**: Go to `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, and select the `manifest.json` file from the folder.

3. **Enjoy TimeLimit**: You should now see the extension icon in your browser. Click it to start managing your focus and limiting distractions.

## Usage

1. **Setting Time Limits**: Click on the extension icon in your browser. Navigate to the **Domain Sets** tab to add domains and specify time limits for them.
2. **Global Blocking Schedule**: Set up your focus schedule under **Settings**. Define times and days when certain domains are automatically blocked.
3. **Active Tab Tracking**: Track your active tab and the time remaining for each domain in the **Dashboard**.
4. **Sync Settings**: Enable the **Sync** option to store your preferences in the cloud and use them across devices.

## Synchronization with Firebase

The extension uses Firebase for synchronization and Google account registration.

1. **Register with Google**: You can register through your Google account, which will assign you a unique sync code.
2. **Use the Sync Code**: You can use this unique code on any device to sync your settings without logging in again. Logging in is only required to copy the sync code if needed.

> **Note**: Ensure your network allows access to Firebase services for synchronization to work properly.

## Development

If you want to contribute or modify the extension, follow these steps:

1. **Install Dependencies**: The project uses npm for managing dependencies. Navigate to the project folder and install the necessary packages:

   ```sh
   npm install
   ```

2. **Build the Extension**: Run the build script to generate a production version of the extension:

   ```sh
   npm run build
   ```

3. **Debugging**: Use the browser's developer console to view logs and debug the background script and popup UI.

## Issues & Troubleshooting

- **Settings Not Syncing**: Ensure that you are signed in with Firebase and your network connection is stable.
- **Website Timer Resets Unexpectedly**: This might happen if settings are erased between sessions. Make sure you are properly synchronizing settings across environments.

## Contributing

Contributions are welcome! Feel free to open issues for bugs, suggest new features, or submit pull requests. Please ensure your code adheres to the style and structure of the existing codebase. Your feedback is highly valued and helps improve TimeLimit.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.

## Acknowledgments

- **Firebase**: For providing seamless authentication and real-time data synchronization.
- **Redux Toolkit**: Used for state management within the extension.
- **Lodash**: For deep cloning and ensuring data immutability in state operations.

---

Stay focused and productive with **TimeLimit**!

## Contact

For further questions, feedback, or support, please reach out at [...].

