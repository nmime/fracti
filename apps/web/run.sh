#!/bin/bash
# Lambda deployment script for React Router SSR

set -e

# Start the server
exec node server/index.js
