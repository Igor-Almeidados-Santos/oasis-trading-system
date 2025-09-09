# ==================== setup.py ====================
"""
setup.py - Package configuration for Oasis Trading System
"""

import os
from pathlib import Path
from setuptools import setup, find_packages

# Read README for long description
this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text(encoding="utf-8")

# Read requirements
def read_requirements(filename):
    """Read requirements from file."""
    with open(filename, 'r', encoding='utf-8') as f:
        return [line.strip() for line in f if line.strip() and not line.startswith('#')]

# Core requirements
install_requires = read_requirements('requirements.txt')

# Development requirements
dev_requires = [
    'pytest>=7.4.0',
    'pytest-asyncio>=0.21.0',
    'pytest-cov>=4.1.0',
    'pytest-mock>=3.12.0',
    'black>=23.11.0',
    'isort>=5.13.0',
    'flake8>=6.1.0',
    'mypy>=1.7.0',
    'pre-commit>=3.5.0',
]

# Documentation requirements
docs_requires = [
    'mkdocs>=1.5.0',
    'mkdocs-material>=9.5.0',
    'mkdocstrings[python]>=0.24.0',
]

setup(
    name='oasis-trading-system',
    version='1.0.0',
    author='Oasis Team',
    author_email='team@oasis-trading.com',
    description='High-Performance Algorithmic Cryptocurrency Trading Bot',
    long_description=long_description,
    long_description_content_type='text/markdown',
    url='https://github.com/oasis-trading/oasis-trading-system',
    project_urls={
        'Documentation': 'https://docs.oasis-trading.com',
        'Bug Tracker': 'https://github.com/oasis-trading/oasis-trading-system/issues',
        'Source Code': 'https://github.com/oasis-trading/oasis-trading-system',
    },
    
    packages=find_packages(where='src'),
    package_dir={'': 'src'},
    
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Financial and Insurance Industry',
        'Topic :: Office/Business :: Financial :: Investment',
        'License :: OSI Approved :: MIT License',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.11',
        'Programming Language :: Python :: 3.12',
        'Operating System :: OS Independent',
        'Framework :: FastAPI',
    ],
    
    python_requires='>=3.11',
    install_requires=install_requires,
    
    extras_require={
        'dev': dev_requires,
        'docs': docs_requires,
        'all': dev_requires + docs_requires,
    },
    
    entry_points={
        'console_scripts': [
            'ots=src.cli.main:app',
            'ots-api=src.api.rest.main:run',
            'ots-worker=src.workers.main:run',
            'ots-backtest=src.backtest.main:run',
        ],
    },
    
    include_package_data=True,
    package_data={
        'src': [
            'config/*.yaml',
            'config/*.json',
            'static/**/*',
            'templates/**/*',
        ],
    },
    
    zip_safe=False,
)