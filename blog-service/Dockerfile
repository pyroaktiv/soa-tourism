# syntax=docker/dockerfile:1.7

FROM eclipse-temurin:25-jdk AS build
WORKDIR /app

RUN apt-get update && apt-get install -y maven

COPY proto ./proto

COPY blog-service/pom.xml ./blog-service/
COPY blog-service/src ./blog-service/src


WORKDIR /app/blog-service
RUN mvn -B -DskipTests clean package

FROM eclipse-temurin:25-jre AS runtime
ENV SPRING_PROFILES_ACTIVE=prod \
    SERVER_PORT=8080

WORKDIR /app
COPY --from=build /app/blog-service/target/*.jar app.jar
EXPOSE 8080 9090
ENTRYPOINT ["java","-jar","app.jar"]
