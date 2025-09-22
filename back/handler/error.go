package handler

import "github.com/gofiber/fiber/v2"

type RequestError struct {
	StatusCode int
	Err        error
}

func (r *RequestError) Error() string {
	return r.Err.Error()
}

func (r *RequestError) Send(c *fiber.Ctx) error {
	return c.Status(r.StatusCode).JSON(fiber.Map{"status": "error", "message": r.getMessage(), "data": r.Err})
}

func (r *RequestError) getMessage() string {
	if r.StatusCode == fiber.StatusBadRequest {
		return "Bad request"
	}
	if r.StatusCode == fiber.StatusNotFound {
		return "Resource not found"
	}
	return "Internal Server Error"
}

func NewRequestError(status int, err error) *RequestError {
	return &RequestError{
		StatusCode: status,
		Err:        err,
	}
}

func SendRequestError(c *fiber.Ctx, status int, err error) error {
	re := &RequestError{
		StatusCode: status,
		Err:        err,
	}
	return re.Send(c)
}
