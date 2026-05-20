#!/bin/bash
cd "$DEPLOYMENT_TARGET"
npm install --omit=dev
echo "Deployment complete"
