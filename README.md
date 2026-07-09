# WhatsApp-to-Pushover Emergency Alerter

A Node.js application that monitors incoming WhatsApp direct messages (DMs) in real-time and forwards high-priority alerts to your mobile device via Pushover when configured user keywords are detected. 

This project ensures you never miss critical messages from family, friends, or monitoring systems, even if your phone or primary WhatsApp notifications are muted.

## Features

* **Automated QR Code Authentication:** Seamlessly authenticates with WhatsApp Web by rendering a scannable QR code directly inside your terminal window.
* **Per-User Keyword Matrix:** Evaluates incoming text payloads and media captions against an isolated dictionary of keywords assigned to specific WhatsApp JIDs or phone numbers.
* **High-Priority Mobile Delivery:** Utilizes Pushover's critical alert schema (priority: 2), which bypasses silent modes, Do Not Disturb configurations, and repeatedly sounds until explicitly acknowledged.
* **Network Fault Tolerance:** Features connection state tracking to automatically handle and recover from temporary network drops without crashing the daemon.
* **Environment Configuration:** Zero hardcoded API keys or personal identifiers. All operational variables are stored locally in an uncommitted environment file.

## Prerequisites

* Node.js (v16 or higher recommended)
* npm (Node Package Manager)
* A registered Pushover account with an active User Key and Application Token.
