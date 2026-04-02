package com.devsforge.runner.modeling;

public class Atomic extends Component implements AtomicInterface {
    protected String phase;
    protected double sigma;

    public Atomic(RunnableModel cfg) {
        super(cfg);
        this.phase = Constants.PASSIVE;
        this.sigma = Constants.INFINITY;
    }

    @Override
    public double ta() {
        return sigma;
    }

    @Override
    public void deltInt() {
        throw new UnsupportedOperationException("Atomic models must implement an internal transition function");
    }

    @Override
    public void deltExt(double e) {
        throw new UnsupportedOperationException("Atomic models must implement an external transition function");
    }

    @Override
    public void deltCon(double e) {
        throw new UnsupportedOperationException("Atomic models must implement a confluent transition function");
    }

    @Override
    public void lambda() {
        throw new UnsupportedOperationException("Atomic models must implement an output function");
    }

    @Override
    public void holdIn(String phase, double sigma) {
        this.phase = phase;
        setSigma(sigma);
    }

    @Override
    public void activate() {
        this.phase = Constants.ACTIVE;
        this.sigma = 0;
    }

    @Override
    public void activateIn(String phase) {
        this.phase = phase;
        this.sigma = 0;
    }

    @Override
    public void passivate() {
        this.phase = Constants.PASSIVE;
        this.sigma = Constants.INFINITY;
    }

    @Override
    public void passivateIn(String phase) {
        this.phase = phase;
        this.sigma = Constants.INFINITY;
    }

    @Override
    public void continueSim(double e) {
        setSigma(sigma - e);
    }

    @Override
    public boolean phaseIs(String phase) {
        return this.phase.equals(phase);
    }

    @Override
    public String getPhase() {
        return phase;
    }

    @Override
    public void setPhase(String phase) {
        this.phase = phase;
    }

    @Override
    public double getSigma() {
        return sigma;
    }

    @Override
    public void setSigma(double sigma) {
        this.sigma = Math.max(sigma, 0);
    }

    @Override
    public String showState() {
        return getName() + " [\tstate: " + phase + "\tsigma: " + sigma + " ]";
    }
}
