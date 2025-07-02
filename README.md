# Urbanite [![Discord](https://img.shields.io/badge/Discord-738ADB)](https://discord.gg/vjpSMSJR8r) [![Full stack build](https://github.com/urban-toolkit/urbanite/actions/workflows/docker-compose.yml/badge.svg)](https://github.com/urban-toolkit/urbanite/actions/workflows/docker-compose.yml)

<div align="center">
  <img src="https://github.com/urban-toolkit/urbanite/blob/main/logo-white.png?raw=true" alt="Urbanite Logo" height="360"/></br>
  [<a href="https://urbantk.org/urbanite">Website</a>]
  <!-- [<a href="https://arxiv.org/abs/2408.06139">Paper</a>] | [<a href="https://urbantk.org/curio">Website</a>] -->
</div>

## Overview

Urbanite is a framework for human-AI collaboration in urban visual analytics that leverages a dataflow-based model allowing users to specify intent at multiple scopes, enabling interactive alignment across specification, process, and evaluation stages. The framework incorporates features for explainability, multi-resolution task definition across dataflows, nodes, and parameters, and supporting interaction provenance based on findings from a survey identifying existing challenges.

**Urbanite: A Dataflow-Based Framework for Human-AI Interactive Alignment in Urban Visual Analytics**  
Gustavo Moreira, Leonardo Ferreira, Carolina Veiga, Maryam Hosseini, and Fabio Miranda  
Paper: Under Review

<div align="center">
  <video src="https://github.com/user-attachments/assets/7d640ca8-52c2-4ff0-9f8d-bd7c64df7073" />
</div>

<!-- <div align="center">
  <video src="https://github.com/urban-toolkit/curio/assets/2387594/6d29bda8-5e94-4496-a4ae-fd55adff024f" />
</div> -->

<p align="center">
  <img src="https://github.com/urban-toolkit/urbanite/blob/main/images/banner.jpg?raw=true" alt="Urbanite Use Cases" width="1000"/>
</p>

This project is part of the [Urban Toolkit ecosystem](https://urbantk.org), which includes [Urbanite](https://github.com/urban-toolkit/urbanite/), [Curio](https://github.com/urban-toolkit/curio/) and [UTK](https://github.com/urban-toolkit/utk). 

## Key features

- Provenance-aware dataflow
- Modularized and collaborative visual analytics
- Support for 2D and 3D maps
- Integration with [UTK](https://urbantk.org) and [Vega-Lite](https://vega.github.io/vega-lite/)
- LLM-based features:
  - Dataflow generation and scaffolding
  - Task & subtask definition
  - Code generation
  - Connection suggestions
  - Dataflow- or node-level explanations
  - Provenance and data inspection 

## Usage and contributions
For detailed instructions on how to use the project, please see the [usage](docs/USAGE.md) document. A set of examples can be found [here](https://github.com/urban-toolkit/urbanite/tree/main/docs). 

🚀 Urbanite now supports a Docker-based setup for easier installation and orchestration of all components. See the [usage guide](docs/USAGE.md) for instructions on running Urbanite with Docker.

If you'd like to contribute, see the [contributions](docs/CONTRIBUTIONS.md) document for guidelines. For questions, join [UTK's Discord](https://discord.gg/vjpSMSJR8r) server.

## Core Team

[Gustavo Moreira](https://gmmuller.github.io/) (UIC)   
Leonardo Ferreira (UIC)  
Carolina Veiga (UIUC)  
[Maryam Hosseini](https://www.maryamhosseini.me/) (UC Berkeley)  
[Fabio Miranda](https://fmiranda.me) (UIC)  

## License
Urbanite is MIT Licensed. Free for both commercial and research use.
