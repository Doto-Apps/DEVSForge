package com.devsforge.runner.modeling;

public interface AtomicInterface extends ComponentInterface {
    double ta();
    void deltInt();
    void deltExt(double e);
    void deltCon(double e);
    void lambda();
    void holdIn(String phase, double sigma);
    void activate();
    void activateIn(String phase);
    void passivate();
    void passivateIn(String phase);
    void continueSim(double e);
    boolean phaseIs(String phase);
    String getPhase();
    void setPhase(String phase);
    double getSigma();
    void setSigma(double sigma);
    String showState();
}
