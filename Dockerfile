FROM openjdk:22-slim-bullseye AS openjdk
FROM node:18.16 AS node

COPY package.json .
COPY index.js .
COPY index.js.map .
COPY index.ts .
COPY node_modules ./node_modules
COPY imports ./imports

RUN apt-get update
RUN apt-get install ffmpeg zip -y

# Install OpenJDK and Kotlin Compiler
COPY --from=openjdk /usr/local/openjdk-22 /usr/local/openjdk-22
ENV PATH="/usr/local/openjdk-22/bin:${PATH}"
ENV JAVA_HOME /usr/local/openjdk-22
ENV JDK_VERSION 22
RUN curl -s https://get.sdkman.io | bash
RUN bash -c "source $HOME/.sdkman/bin/sdkman-init.sh && sdk install kotlin"

ENTRYPOINT ["node", "index.js"]
