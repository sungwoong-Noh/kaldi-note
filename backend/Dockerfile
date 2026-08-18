# syntax=docker/dockerfile:1

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY build/libs/*.jar app.jar
ENV JAVA_OPTS="-XX:MaxRAMPercentage=50"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
