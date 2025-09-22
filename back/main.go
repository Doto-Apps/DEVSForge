// @title Easy DEVS API
// @version 1.0
// @description This is the API documentation for Easy DEVS.
// @host localhost:3000
// @BasePath /

package main

import (
	"devsforge/back/database"
	"log"

	"devsforge/back/router"

	_ "devsforge/back/docs"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/gofiber/swagger"
)

func main() {
	app := fiber.New(fiber.Config{
		Prefork:       true,
		CaseSensitive: true,
		StrictRouting: true,
		ServerHeader:  "Fiber",
		AppName:       "Easy DEVS",
	})
	app.Use(cors.New())

	app.Use(requestid.New())
	app.Use(logger.New(logger.Config{
		// For more options, see the Config section
		Format: "${pid} ${locals:requestid} ${status} - ${method} ${path}​\n",
	}))
	app.Use(recover.New())

	database.ConnectDB()

	router.SetupRoutes(app)
	app.Get("/swagger/*", swagger.HandlerDefault)

	log.Fatal(app.Listen(":3000"))
}
