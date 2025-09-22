swag init

swagger2openapi -o ../back/docs/openapi.json ../back/docs/swagger.json 

npx openapi-typescript ../back/docs/openapi.json -o ./src/api/v1.d.ts