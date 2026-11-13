package com.devsforge.ms4me;

/** Raised at startup when the user model cannot be loaded or does not match the manifest. */
public class ModelLoadException extends Exception {
    private static final long serialVersionUID = 1L;

    public ModelLoadException(String message) {
        super(message);
    }

    public ModelLoadException(String message, Throwable cause) {
        super(message, cause);
    }
}
