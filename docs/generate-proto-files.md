# Generate proto files for wrappers

# Prerequisite

- Ensure `protoc --version` returns `libprotoc 34.1` Or you will need to update all deps in all wrappers

## Java

- Using java-openjdk21
- Plugin: protoc-gen-grpc-java-1.60.0-linux-x86_64.exe

```sh
wget https://repo1.maven.org/maven2/io/grpc/protoc-gen-grpc-java/1.60.0/protoc-gen-grpc-java-1.60.0-linux-x86_64.exe
chmod +x protoc-gen-grpc-java-1.60.0-linux-x86_64.exe
```

- Generate :

```sh
protoc --proto_path=simulator/proto/ \
--java_out=./simulator/wrappers/java/src/main/generated/ \
--grpc-java_out=./simulator/wrappers/java/src/main/generated/ \
--plugin=protoc-gen-grpc-java=./protoc-gen-grpc-java-1.60.0-linux-x86_64.exe \
simulator/proto/devs.proto
```
