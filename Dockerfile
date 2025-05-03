FROM apify/actor-node:18

# Second, copy just package.json and package-lock.json since they are the only files
# that affect NPM install in the next step
COPY package.json ./

# Install NPM packages, skip optional and development dependencies to keep the
# image small. Avoid logging too much and print the dependency tree for debugging
RUN npm --quiet set progress=false \
 && npm install --only=prod --no-optional \
 && echo "Installed NPM packages:" \
 && (npm list || true) \
 && echo "Node.js version:" \
 && node --version \
 && echo "NPM version:" \
 && npm --version

# Next, copy the rest of your actor's source code
COPY . ./

# Optional: copy the contents of the INPUT_SCHEMA.json file
# to the actor's default input schema definition
RUN if [ -f INPUT_SCHEMA.json ]; then \
        mkdir -p .actor && \
        cp ./INPUT_SCHEMA.json .actor/INPUT_SCHEMA.json; \
    fi

# Run the image. This is the command that is run when the container starts
CMD ["node", "main.js"]
